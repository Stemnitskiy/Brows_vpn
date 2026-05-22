package messaging

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestLengthPrefixedRoundTrip(t *testing.T) {
	in := Message{
		Version:     "1.0",
		MessageType: "command",
		MessageID:   "test_1",
		Payload: map[string]interface{}{
			"command": "get_status",
		},
	}

	var buf bytes.Buffer
	data, err := encodeMessage(in)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if err := writeMessage(&buf, data); err != nil {
		t.Fatalf("write: %v", err)
	}

	read, err := readMessage(&buf)
	if err != nil {
		t.Fatalf("read: %v", err)
	}

	var out Message
	if err := json.Unmarshal(read, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if out.MessageID != in.MessageID {
		t.Fatalf("message_id mismatch")
	}
}
