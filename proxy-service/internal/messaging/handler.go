package messaging

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"browsvpn-proxy/internal/health"
	"browsvpn-proxy/internal/logging"
	"browsvpn-proxy/internal/xray"
	"browsvpn-proxy/pkg/vless"
)

// VPNHandler handles native messaging commands and controls Xray.
type VPNHandler struct {
	logger       *logging.Logger
	xray         *xray.XrayController
	origin       *OriginGate
	mu           sync.Mutex
	vlessURL     string
	socksPort    int
	enabled      bool
}

// NewVPNHandler creates a handler wired to Xray.
func NewVPNHandler(logger *logging.Logger, callerOrigin string) *VPNHandler {
	controller := xray.NewXrayController()
	if logger != nil {
		controller.SetOutputWriters(logger.Logger.Out, logger.Logger.Out)
	}
	gate := NewOriginGate(callerOrigin)
	if logger != nil && gate.CallerOrigin() != "" {
		logger.Infof("Native messaging caller: %s", gate.CallerOrigin())
	}
	return &VPNHandler{
		logger:    logger,
		xray:      controller,
		origin:    gate,
		socksPort: 10808,
	}
}

// HandleMessage processes an incoming native messaging command.
func (h *VPNHandler) HandleMessage(msg Message) (Message, error) {
	switch msg.MessageType {
	case "command":
		return h.handleCommand(msg)
	default:
		return h.withMessageID(msg, h.errorResponse("Unknown message type")), nil
	}
}

func (h *VPNHandler) handleCommand(msg Message) (Message, error) {
	if h.origin != nil && !h.origin.Allow() {
		return h.withMessageID(msg, h.errorResponse("Access denied for extension origin")), nil
	}

	command, ok := msg.Payload["command"].(string)
	if !ok {
		return h.withMessageID(msg, h.errorResponse("Missing command in payload")), nil
	}

	switch command {
	case "enable_vpn":
		return h.handleEnableVPN(msg)
	case "disable_vpn":
		return h.handleDisableVPN(msg)
	case "get_status":
		return h.handleGetStatus(msg)
	case "get_logs":
		return h.handleGetLogs(msg)
	case "preflight":
		return h.handlePreflight(msg)
	case "health_check":
		return h.handleHealthCheck(msg)
	case "find_free_port":
		return h.handleFindFreePort(msg)
	default:
		return h.withMessageID(msg, h.errorResponse("Unknown command: "+command)), nil
	}
}

func (h *VPNHandler) handleEnableVPN(msg Message) (Message, error) {
	config, ok := msg.Payload["config"].(map[string]interface{})
	if !ok {
		return h.withMessageID(msg, h.errorResponse("Missing config in payload")), nil
	}

	vlessURL, ok := config["vless_url"].(string)
	if !ok || vlessURL == "" {
		return h.withMessageID(msg, h.errorResponse("Missing vless_url in config")), nil
	}

	socksPort := 10808
	if port, ok := config["socks_port"].(float64); ok && port > 0 {
		socksPort = int(port)
	}

	// Stop before preflight so port-bind check does not fail on reconnect.
	h.mu.Lock()
	if err := h.xray.Stop(); err != nil {
		h.logError("failed to stop existing xray before enable: %v", err)
	}
	h.mu.Unlock()

	preflight := health.RunPreflight(vlessURL, socksPort)
	if !preflight.OK {
		errMsg := health.FirstError(preflight)
		if errMsg == "" {
			errMsg = "preflight checks failed"
		}
		h.logError("preflight failed: %s", errMsg)
		return h.withMessageID(msg, h.errorResponseWithData(errMsg, map[string]interface{}{
			"preflight": health.ReportMap(preflight),
		})), nil
	}

	parsed, err := vless.ParseVLESSURL(vlessURL)
	if err != nil {
		return h.withMessageID(msg, h.errorResponse("Invalid VLESS URL: "+err.Error())), nil
	}
	if err := parsed.Validate(); err != nil {
		return h.withMessageID(msg, h.errorResponse("Invalid VLESS config: "+err.Error())), nil
	}

	h.logInfo("enable_vpn: server=%s:%d transport=%s security=%s sni=%s socks=%d",
		parsed.Address, parsed.Port, parsed.Type, parsed.Security, parsed.SNI, socksPort)

	h.mu.Lock()
	defer h.mu.Unlock()

	xrayConfig := parsed.ToXrayConfig(socksPort)
	if err := h.xray.SetConfig(xrayConfig); err != nil {
		return h.withMessageID(msg, h.errorResponse("Failed to set Xray config: "+err.Error())), nil
	}

	binaryPath, err := xray.ResolveBinaryPath()
	if err != nil {
		return h.withMessageID(msg, h.errorResponse("Xray binary unavailable")), nil
	}
	if err := xray.VerifyBinaryIntegrity(binaryPath); err != nil {
		return h.withMessageID(msg, h.errorResponse("Xray integrity check failed")), nil
	}

	workDir, err := xray.ResolveWorkDir()
	if err != nil {
		return h.withMessageID(msg, h.errorResponse(err.Error())), nil
	}

	configPath, err := h.xray.WriteConfigFile(workDir)
	if err != nil {
		return h.withMessageID(msg, h.errorResponse("Failed to write Xray config: "+err.Error())), nil
	}

	if err := h.xray.Start(binaryPath, workDir, configPath); err != nil {
		h.logError("xray start failed: %v", err)
		return h.withMessageID(msg, h.errorResponse("Failed to start Xray: "+err.Error())), nil
	}

	h.logInfo("xray started config=%s", configPath)

	if err := health.WaitForPort("127.0.0.1", socksPort, 5*time.Second); err != nil {
		_ = h.xray.Stop()
		h.logError("socks not listening: %v", err)
		return h.withMessageID(msg, h.errorResponse("SOCKS port not listening after Xray start: "+err.Error())), nil
	}

	runtime := health.RunRuntime(h.xray.IsRunning(), socksPort)
	if !runtime.OK {
		_ = h.xray.Stop()
		errMsg := health.FirstError(runtime)
		if errMsg == "" {
			errMsg = "runtime health check failed"
		}
		return h.withMessageID(msg, h.errorResponseWithData(errMsg, map[string]interface{}{
			"runtime": health.ReportMap(runtime),
		})), nil
	}

	h.vlessURL = vlessURL
	h.socksPort = socksPort
	h.enabled = true

	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"vpn_status":  "enabled",
		"socks_proxy": fmt.Sprintf("127.0.0.1:%d", socksPort),
		"config_id":   "config_001",
		"preflight":   health.ReportMap(preflight),
		"runtime":     health.ReportMap(runtime),
	})), nil
}

func (h *VPNHandler) handleDisableVPN(msg Message) (Message, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if err := h.xray.Stop(); err != nil {
		return h.withMessageID(msg, h.errorResponse("Failed to stop Xray: "+err.Error())), nil
	}
	_ = h.xray.RemoveConfigFile()

	h.enabled = false
	h.vlessURL = ""

	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"vpn_status": "disabled",
	})), nil
}

func (h *VPNHandler) handleGetStatus(msg Message) (Message, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	status := "disabled"
	if h.enabled && h.xray.IsRunning() {
		status = "enabled"
	} else if h.enabled && !h.xray.IsRunning() {
		status = "error"
	}

	runtime := health.RunRuntime(h.xray.IsRunning(), h.socksPort)

	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"vpn_status":   status,
		"socks_proxy":  fmt.Sprintf("127.0.0.1:%d", h.socksPort),
		"xray_running": h.xray.IsRunning(),
		"has_config":   h.vlessURL != "",
		"runtime":      health.ReportMap(runtime),
	})), nil
}

func (h *VPNHandler) handlePreflight(msg Message) (Message, error) {
	vlessURL := ""
	socksPort := 10808

	if config, ok := msg.Payload["config"].(map[string]interface{}); ok {
		if u, ok := config["vless_url"].(string); ok {
			vlessURL = u
		}
		if port, ok := config["socks_port"].(float64); ok && port > 0 {
			socksPort = int(port)
		}
	}
	if u, ok := msg.Payload["vless_url"].(string); ok && u != "" {
		vlessURL = u
	}
	if port, ok := msg.Payload["socks_port"].(float64); ok && port > 0 {
		socksPort = int(port)
	}

	report := health.RunPreflight(vlessURL, socksPort)
	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"preflight": health.ReportMap(report),
	})), nil
}

func (h *VPNHandler) handleFindFreePort(msg Message) (Message, error) {
	preferred := 10808
	if p, ok := msg.Payload["preferred_port"].(float64); ok && p > 0 {
		preferred = int(p)
	}

	port, report := health.FindFreePort(preferred)
	if port == 0 {
		errMsg := health.FirstError(report)
		if errMsg == "" {
			errMsg = "Не удалось найти свободный порт"
		}
		return h.withMessageID(msg, h.errorResponseWithData(errMsg, map[string]interface{}{
			"find_port": health.ReportMap(report),
		})), nil
	}

	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"port":      port,
		"find_port": health.ReportMap(report),
	})), nil
}

func (h *VPNHandler) handleHealthCheck(msg Message) (Message, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	report := health.RunRuntime(h.xray.IsRunning(), h.socksPort)
	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"enabled":   h.enabled,
		"runtime":   health.ReportMap(report),
	})), nil
}

func (h *VPNHandler) withMessageID(in Message, out Message) Message {
	out.MessageID = in.MessageID
	if out.Version == "" {
		out.Version = "1.0"
	}
	return out
}

func (h *VPNHandler) successResponse(data map[string]interface{}) Message {
	return Message{
		Version:     "1.0",
		MessageType: "response",
		Payload: map[string]interface{}{
			"status": "success",
			"data":   data,
		},
	}
}

func (h *VPNHandler) errorResponse(message string) Message {
	return h.errorResponseWithData(message, nil)
}

func (h *VPNHandler) errorResponseWithData(message string, data map[string]interface{}) Message {
	payload := map[string]interface{}{
		"status": "error",
		"error": map[string]interface{}{
			"message": message,
		},
	}
	if data != nil {
		payload["data"] = data
	}
	return Message{
		Version:     "1.0",
		MessageType: "response",
		Payload:     payload,
	}
}

func (h *VPNHandler) handleGetLogs(msg Message) (Message, error) {
	workDir, err := xray.ResolveWorkDir()
	if err != nil {
		return h.withMessageID(msg, h.errorResponse(err.Error())), nil
	}

	exeDir := workDir
	if exe, err := os.Executable(); err == nil {
		exeDir = filepath.Dir(exe)
	}

	appLog := filepath.Join(exeDir, "logs", "app.log")
	errorLog := filepath.Join(workDir, "error.log")

	read := func(path string) string {
		lines, err := tailFile(path, 80)
		if err != nil {
			return fmt.Sprintf("(unavailable: %v)", err)
		}
		return joinLines(lines)
	}

	return h.withMessageID(msg, h.successResponse(map[string]interface{}{
		"app_log":      redactLogText(read(appLog)),
		"error_log":    redactLogText(read(errorLog)),
		"xray_running": h.xray.IsRunning(),
	})), nil
}

func (h *VPNHandler) logInfo(format string, args ...interface{}) {
	if h.logger != nil {
		h.logger.Infof(format, args...)
	}
}

func (h *VPNHandler) logError(format string, args ...interface{}) {
	if h.logger != nil {
		h.logger.Errorf(format, args...)
	}
}

// Stop shuts down Xray (for process exit).
func (h *VPNHandler) Stop() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.xray.Stop()
}
