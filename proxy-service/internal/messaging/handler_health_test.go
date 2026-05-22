package messaging

import "testing"

func TestHandlePreflight(t *testing.T) {
	h := NewVPNHandler(nil)
	resp, err := h.HandleMessage(Message{
		MessageType: "command",
		MessageID:   "pf1",
		Payload: map[string]interface{}{
			"command": "preflight",
			"config": map[string]interface{}{
				"vless_url":  "",
				"socks_port": float64(10808),
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	data, _ := resp.Payload["data"].(map[string]interface{})
	pf, _ := data["preflight"].(map[string]interface{})
	if pf["ok"] == true {
		t.Fatal("expected preflight failure for empty vless")
	}
}

func TestHandleHealthCheck(t *testing.T) {
	h := NewVPNHandler(nil)
	resp, err := h.HandleMessage(Message{
		MessageType: "command",
		MessageID:   "hc1",
		Payload:     map[string]interface{}{"command": "health_check"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Payload["status"] != "success" {
		t.Fatalf("unexpected status: %v", resp.Payload)
	}
}

func TestHandleFindFreePort(t *testing.T) {
	h := NewVPNHandler(nil)
	resp, err := h.HandleMessage(Message{
		MessageType: "command",
		MessageID:   "fp1",
		Payload: map[string]interface{}{
			"command":        "find_free_port",
			"preferred_port": float64(10808),
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Payload["status"] != "success" {
		t.Fatalf("unexpected status: %v", resp.Payload)
	}
	data, _ := resp.Payload["data"].(map[string]interface{})
	portVal, ok := data["port"]
	if !ok {
		t.Fatalf("missing port in response: %v", data)
	}
	var port int
	switch v := portVal.(type) {
	case float64:
		port = int(v)
	case int:
		port = v
	default:
		t.Fatalf("unexpected port type: %T", portVal)
	}
	if port <= 0 {
		t.Fatalf("expected positive port, got %d", port)
	}
}
