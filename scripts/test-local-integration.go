package main

import (
	"encoding/binary"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

const testVLESS = "vless://550e8400-e29b-41d4-a716-446655440000@vpn.example.com:443" +
	"?type=grpc&encryption=none&serviceName=vpn&security=reality" +
	"&pbk=z0erta-2ehJTvkYEmAc-UWhY8qPiNzXjQLRzF1bkB3g&fp=chrome&sni=example.com&sid=abcd&spx=%2F#LocalTest"

type nmMessage struct {
	Version     string                 `json:"version"`
	MessageType string                 `json:"message_type"`
	MessageID   string                 `json:"message_id"`
	Payload     map[string]interface{} `json:"payload"`
}

func main() {
	live := flag.Bool("live", false, "also run enable_vpn, check SOCKS port, and disable_vpn")
	rootFlag := flag.String("root", "", "repository root or proxy-service directory")
	exeFlag := flag.String("exe", "", "path to browsvpn-proxy.exe")
	flag.Parse()

	root := resolveProxyRoot(*rootFlag)
	exe := *exeFlag
	if exe == "" {
		exe = filepath.Join(root, "browsvpn-proxy.exe")
	}
	if _, err := os.Stat(exe); err != nil {
		fail("browsvpn-proxy.exe not found: %s. Run: cd proxy-service; .\\install.ps1 -Build", exe)
	}

	fmt.Println("=== Brows VPN Local Integration Test ===")
	if *live {
		fmt.Println("Mode: live enable/disable")
	} else {
		fmt.Println("Mode: safe smoke (use -live for enable_vpn)")
	}
	fmt.Println()

	host := startHost(exe)
	defer host.stop()

	fmt.Print("[1/5] get_status ... ")
	resp := host.send("t1", map[string]interface{}{"command": "get_status"})
	data := assertSuccess(resp)
	assertString(data, "vpn_status", "disabled")
	fmt.Println("OK")

	fmt.Print("[2/5] find_free_port ... ")
	resp = host.send("t2", map[string]interface{}{
		"command":        "find_free_port",
		"preferred_port": float64(10808),
	})
	data = assertSuccess(resp)
	port := intFromData(data, "port")
	if port <= 0 || port > 65535 {
		fail("invalid free port: %v", data["port"])
	}
	fmt.Printf("OK (%d)\n", port)

	fmt.Print("[3/5] preflight ... ")
	resp = host.send("t3", map[string]interface{}{
		"command": "preflight",
		"config": map[string]interface{}{
			"vless_url":  testVLESS,
			"socks_port": float64(port),
		},
	})
	data = assertSuccess(resp)
	assertReportOK(data, "preflight")
	fmt.Println("OK")

	fmt.Print("[4/5] health_check ... ")
	resp = host.send("t4", map[string]interface{}{"command": "health_check"})
	data = assertSuccess(resp)
	if _, ok := data["runtime"].(map[string]interface{}); !ok {
		fail("missing runtime report: %v", data)
	}
	fmt.Println("OK")

	fmt.Print("[5/5] disable_vpn ... ")
	resp = host.send("t5", map[string]interface{}{"command": "disable_vpn"})
	data = assertSuccess(resp)
	assertString(data, "vpn_status", "disabled")
	fmt.Println("OK")

	if *live {
		runLiveEnableDisable(host, port)
	}

	fmt.Println()
	fmt.Println("All local integration checks passed.")
}

type hostProcess struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
}

func startHost(exe string) *hostProcess {
	cmd := exec.Command(exe)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		fail("stdin pipe: %v", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		fail("stdout pipe: %v", err)
	}
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		fail("start host: %v", err)
	}
	return &hostProcess{cmd: cmd, stdin: stdin, stdout: stdout}
}

func (h *hostProcess) stop() {
	_ = h.stdin.Close()
	_ = h.cmd.Process.Kill()
	_ = h.cmd.Wait()
}

func (h *hostProcess) send(messageID string, payload map[string]interface{}) map[string]interface{} {
	msg := nmMessage{
		Version:     "1.0",
		MessageType: "command",
		MessageID:   messageID,
		Payload:     payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		fail("marshal: %v", err)
	}

	header := make([]byte, 4)
	binary.LittleEndian.PutUint32(header, uint32(len(data)))
	if _, err := h.stdin.Write(append(header, data...)); err != nil {
		fail("write stdin: %v", err)
	}

	respBytes := readFrame(h.stdout, 15*time.Second)
	var resp nmMessage
	if err := json.Unmarshal(respBytes, &resp); err != nil {
		fail("parse response: %v\nraw: %s", err, string(respBytes))
	}
	if resp.MessageID != messageID {
		fail("expected message_id=%s, got %s", messageID, resp.MessageID)
	}
	return resp.Payload
}

func readFrame(r io.Reader, timeout time.Duration) []byte {
	hdr := readExact(r, 4, timeout)
	n := binary.LittleEndian.Uint32(hdr)
	if n == 0 || n > 1024*1024 {
		fail("invalid frame length: %d", n)
	}
	return readExact(r, int(n), timeout)
}

func readExact(r io.Reader, n int, timeout time.Duration) []byte {
	type result struct {
		data []byte
		err  error
	}
	ch := make(chan result, 1)
	go func() {
		buf := make([]byte, n)
		_, err := io.ReadFull(r, buf)
		ch <- result{data: buf, err: err}
	}()

	select {
	case res := <-ch:
		if res.err != nil {
			fail("read frame: %v", res.err)
		}
		return res.data
	case <-time.After(timeout):
		fail("timeout waiting for native host response")
	}
	return nil
}

func runLiveEnableDisable(host *hostProcess, port int) {
	fmt.Print("[live 1/3] enable_vpn ... ")
	resp := host.send("live1", map[string]interface{}{
		"command": "enable_vpn",
		"config": map[string]interface{}{
			"vless_url":  testVLESS,
			"socks_port": float64(port),
		},
	})
	data := assertSuccess(resp)
	assertString(data, "vpn_status", "enabled")
	fmt.Println("OK")

	fmt.Printf("[live 2/3] SOCKS 127.0.0.1:%d listening ... ", port)
	if !waitForPort(fmt.Sprintf("127.0.0.1:%d", port), 5*time.Second) {
		fail("port %d not listening after enable_vpn", port)
	}
	fmt.Println("OK")

	fmt.Print("[live 3/3] disable_vpn ... ")
	resp = host.send("live2", map[string]interface{}{"command": "disable_vpn"})
	data = assertSuccess(resp)
	assertString(data, "vpn_status", "disabled")
	fmt.Println("OK")
}

func assertSuccess(payload map[string]interface{}) map[string]interface{} {
	if payload["status"] != "success" {
		fail("expected success, got: %v", payload)
	}
	data, _ := payload["data"].(map[string]interface{})
	if data == nil {
		fail("missing data in response: %v", payload)
	}
	return data
}

func assertString(data map[string]interface{}, key, want string) {
	if data[key] != want {
		fail("expected %s=%s, got %v", key, want, data[key])
	}
}

func assertReportOK(data map[string]interface{}, key string) {
	report, _ := data[key].(map[string]interface{})
	if report == nil {
		fail("missing %s report: %v", key, data)
	}
	if report["ok"] != true {
		fail("%s failed: %v", key, report)
	}
}

func intFromData(data map[string]interface{}, key string) int {
	switch v := data[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	default:
		fail("missing or invalid %s: %v", key, data[key])
	}
	return 0
}

func resolveProxyRoot(rootFlag string) string {
	if rootFlag != "" {
		root, err := filepath.Abs(rootFlag)
		if err != nil {
			fail("resolve root: %v", err)
		}
		if filepath.Base(root) != "proxy-service" {
			root = filepath.Join(root, "proxy-service")
		}
		return root
	}

	root, err := os.Getwd()
	if err != nil {
		fail("getwd: %v", err)
	}
	if filepath.Base(root) != "proxy-service" {
		root = filepath.Join(root, "proxy-service")
	}
	return root
}

func waitForPort(addr string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 300*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return true
		}
		time.Sleep(200 * time.Millisecond)
	}
	return false
}

func fail(format string, args ...interface{}) {
	fmt.Println("FAIL")
	fmt.Fprintf(os.Stderr, "ERROR: "+format+"\n", args...)
	os.Exit(1)
}
