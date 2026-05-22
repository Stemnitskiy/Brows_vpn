package messaging

import (
	"testing"
)

func TestVPNHandlerGetStatus(t *testing.T) {
	handler := NewVPNHandler(nil)

	resp, err := handler.HandleMessage(Message{
		Version:     "1.0",
		MessageType: "command",
		MessageID:   "msg_1",
		Payload: map[string]interface{}{
			"command": "get_status",
		},
	})
	if err != nil {
		t.Fatalf("HandleMessage: %v", err)
	}

	if resp.MessageID != "msg_1" {
		t.Fatalf("expected message_id echoed")
	}

	status, _ := resp.Payload["status"].(string)
	if status != "success" {
		t.Fatalf("expected success, got %v", resp.Payload)
	}

	data, _ := resp.Payload["data"].(map[string]interface{})
	if data["vpn_status"] != "disabled" {
		t.Fatalf("expected disabled status, got %v", data["vpn_status"])
	}
}

func TestVPNHandlerEnableInvalidURL(t *testing.T) {
	handler := NewVPNHandler(nil)

	resp, err := handler.HandleMessage(Message{
		Version:     "1.0",
		MessageType: "command",
		MessageID:   "msg_2",
		Payload: map[string]interface{}{
			"command": "enable_vpn",
			"config": map[string]interface{}{
				"vless_url": "not-a-vless-url",
			},
		},
	})
	if err != nil {
		t.Fatalf("HandleMessage: %v", err)
	}

	if resp.Payload["status"] != "error" {
		t.Fatalf("expected error response")
	}
}
