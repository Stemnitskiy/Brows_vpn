package main

import (
	"encoding/binary"
	"encoding/json"
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
	root, _ := os.Getwd()
	if filepath.Base(root) != "proxy-service" {
		root = filepath.Join(root, "proxy-service")
	}

	exe := filepath.Join(root, "browsvpn-proxy.exe")
	if _, err := os.Stat(exe); err != nil {
		fail("browsvpn-proxy.exe not found — run: go build -o browsvpn-proxy.exe ./cmd")
	}

	fmt.Println("=== Brows VPN Local Integration Test ===")
	fmt.Println()

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
	defer func() {
		_ = stdin.Close()
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	}()

	// 1. get_status
	fmt.Print("[1/4] get_status ... ")
	resp := send(stdin, stdout, nmMessage{
		Version: "1.0", MessageType: "command", MessageID: "t1",
		Payload: map[string]interface{}{"command": "get_status"},
	})
	assertSuccess(resp, "disabled")
	fmt.Println("OK")

	// 2. enable_vpn
	fmt.Print("[2/4] enable_vpn ... ")
	resp = send(stdin, stdout, nmMessage{
		Version: "1.0", MessageType: "command", MessageID: "t2",
		Payload: map[string]interface{}{
			"command": "enable_vpn",
			"config": map[string]interface{}{
				"vless_url":  testVLESS,
				"socks_port": float64(10808),
			},
		},
	})
	assertSuccess(resp, "enabled")
	fmt.Println("OK")

	// 3. SOCKS port listening
	fmt.Print("[3/4] SOCKS 127.0.0.1:10808 listening ... ")
	if !waitForPort("127.0.0.1:10808", 5*time.Second) {
		fail("port 10808 not listening after enable_vpn")
	}
	fmt.Println("OK")

	// 4. disable_vpn
	fmt.Print("[4/4] disable_vpn ... ")
	resp = send(stdin, stdout, nmMessage{
		Version: "1.0", MessageType: "command", MessageID: "t3",
		Payload: map[string]interface{}{"command": "disable_vpn"},
	})
	assertSuccess(resp, "disabled")
	fmt.Println("OK")

	fmt.Println()
	fmt.Println("All local integration tests passed.")
}

func send(stdin io.Writer, stdout io.Reader, msg nmMessage) map[string]interface{} {
	data, err := json.Marshal(msg)
	if err != nil {
		fail("marshal: %v", err)
	}

	header := make([]byte, 4)
	binary.LittleEndian.PutUint32(header, uint32(len(data)))
	if _, err := stdin.Write(append(header, data...)); err != nil {
		fail("write stdin: %v", err)
	}

	respBytes := readFrame(stdout)
	var resp nmMessage
	if err := json.Unmarshal(respBytes, &resp); err != nil {
		fail("parse response: %v\nraw: %s", err, string(respBytes))
	}
	return resp.Payload
}

func readFrame(r io.Reader) []byte {
	hdr := make([]byte, 4)
	if _, err := io.ReadFull(r, hdr); err != nil {
		fail("read header: %v", err)
	}
	n := binary.LittleEndian.Uint32(hdr)
	body := make([]byte, n)
	if _, err := io.ReadFull(r, body); err != nil {
		fail("read body: %v", err)
	}
	return body
}

func assertSuccess(payload map[string]interface{}, wantVPNStatus string) {
	if payload["status"] != "success" {
		fail("expected success, got: %v", payload)
	}
	data, _ := payload["data"].(map[string]interface{})
	if data == nil {
		fail("missing data in response: %v", payload)
	}
	if data["vpn_status"] != wantVPNStatus {
		fail("expected vpn_status=%s, got %v", wantVPNStatus, data["vpn_status"])
	}
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
