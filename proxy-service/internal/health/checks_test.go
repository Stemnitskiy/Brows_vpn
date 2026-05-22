package health

import "testing"

func TestRunPreflightInvalidVLESS(t *testing.T) {
	report := RunPreflight("not-vless", 10808)
	if report.OK {
		t.Fatal("expected failure for invalid URL")
	}
}

func TestRunPreflightEmptyURL(t *testing.T) {
	report := RunPreflight("", 10808)
	if report.OK {
		t.Fatal("expected failure for empty URL")
	}
}

func TestRunPreflightWindowsBadPort(t *testing.T) {
	report := RunPreflight("vless://550e8400-e29b-41d4-a716-446655440000@x:443?type=grpc&security=reality&pbk=k&sni=x&serviceName=v", 1080)
	found := false
	for _, c := range report.Checks {
		if c.ID == "socks_port" && !c.OK {
			found = true
		}
	}
	if !found {
		t.Fatal("expected warn/error for port 1080")
	}
}

func TestIsPortListeningClosed(t *testing.T) {
	if IsPortListening("127.0.0.1", 59999) {
		t.Fatal("unexpected open port")
	}
}
