package health

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"time"

	"browsvpn-proxy/internal/xray"
	"browsvpn-proxy/pkg/vless"
)

// Check describes one validation result.
type Check struct {
	ID      string `json:"id"`
	OK      bool   `json:"ok"`
	Level   string `json:"level"` // info, warn, error
	Message string `json:"message"`
}

// Report aggregates preflight or runtime checks.
type Report struct {
	OK     bool    `json:"ok"`
	Checks []Check `json:"checks"`
}

func (r *Report) add(id, level, message string, ok bool) {
	r.Checks = append(r.Checks, Check{
		ID: id, OK: ok, Level: level, Message: message,
	})
	if !ok && level == "error" {
		r.OK = false
	}
}

// NewReport creates an empty passing report.
func NewReport() *Report {
	return &Report{OK: true, Checks: []Check{}}
}

// RunPreflight validates environment before starting VPN.
func RunPreflight(vlessURL string, socksPort int) *Report {
	report := NewReport()

	if socksPort <= 0 || socksPort > 65535 {
		report.add("socks_port", "error", fmt.Sprintf("некорректный SOCKS-порт: %d", socksPort), false)
		return report
	}

	if socksPort >= 1068 && socksPort <= 1167 {
		report.add("socks_port", "error",
			fmt.Sprintf("порт %d в запрещённом диапазоне Windows 1068–1167; используйте 10808", socksPort), false)
	}

	if IsPortListening("127.0.0.1", socksPort) {
		report.add("socks_port_bind", "info",
			fmt.Sprintf("порт %d уже слушает 127.0.0.1 (будет переиспользован при переподключении)", socksPort), true)
	} else if err := checkPortBindable(socksPort); err != nil {
		report.add("socks_port_bind", "error", err.Error(), false)
	} else {
		report.add("socks_port_bind", "info", fmt.Sprintf("порт %d доступен на 127.0.0.1", socksPort), true)
	}

	if _, err := xray.ResolveBinaryPath(); err != nil {
		report.add("xray_binary", "error", err.Error(), false)
	} else {
		report.add("xray_binary", "info", "xray.exe найден", true)
	}

	workDir, err := xray.ResolveWorkDir()
	if err != nil {
		report.add("xray_workdir", "error", err.Error(), false)
	} else {
		geoMissing := false
		for _, file := range []string{"geoip.dat", "geosite.dat"} {
			path := filepath.Join(workDir, file)
			if _, err := os.Stat(path); err != nil {
				report.add("xray_geo_"+file, "warn", fmt.Sprintf("отсутствует %s (маршрутизация может не работать)", file), false)
				geoMissing = true
			}
		}
		if !geoMissing {
			report.add("xray_geo", "info", "geoip.dat и geosite.dat на месте", true)
		}
		report.add("xray_workdir", "info", "каталог xray-core в порядке", true)
	}

	if vlessURL == "" {
		report.add("vless_url", "error", "VLESS URL не задан", false)
		return report
	}

	parsed, err := vless.ParseVLESSURL(vlessURL)
	if err != nil {
		report.add("vless_parse", "error", err.Error(), false)
		return report
	}
	if err := parsed.Validate(); err != nil {
		report.add("vless_validate", "error", err.Error(), false)
		return report
	}

	report.add("vless_parse", "info",
		fmt.Sprintf("VLESS OK: %s:%d %s/%s sni=%s", parsed.Address, parsed.Port, parsed.Type, parsed.Security, parsed.SNI), true)

	if parsed.Security == "reality" && parsed.PublicKey == "" {
		report.add("vless_reality", "error", "Reality требует pbk (публичный ключ)", false)
	}

	return report
}

// RunRuntime checks live VPN state.
func RunRuntime(xrayRunning bool, socksPort int) *Report {
	report := NewReport()

	if !xrayRunning {
		report.add("xray_process", "error", "процесс Xray не запущен", false)
	} else {
		report.add("xray_process", "info", "процесс Xray запущен", true)
	}

	if IsPortListening("127.0.0.1", socksPort) {
		report.add("socks_listen", "info", fmt.Sprintf("SOCKS слушает 127.0.0.1:%d", socksPort), true)
	} else {
		report.add("socks_listen", "error", fmt.Sprintf("SOCKS не слушает 127.0.0.1:%d", socksPort), false)
	}

	return report
}

// WaitForPort polls until the port accepts TCP connections or timeout.
func WaitForPort(host string, port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("%s:%d", host, port)
	for time.Now().Before(deadline) {
		if IsPortListening(host, port) {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("таймаут ожидания %s", addr)
}

// IsPortListening returns true if a TCP connection can be established.
func IsPortListening(host string, port int) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), 300*time.Millisecond)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

func checkPortBindable(port int) error {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return fmt.Errorf("не удалось занять 127.0.0.1:%d: %w", port, err)
	}
	_ = ln.Close()
	return nil
}
