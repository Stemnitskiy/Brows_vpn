package messaging

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

const maxMessageSize = 1024 * 1024

// readMessage reads a Chrome native messaging frame: 4-byte LE length + JSON.
func readMessage(r io.Reader) ([]byte, error) {
	var lengthBuf [4]byte
	if _, err := io.ReadFull(r, lengthBuf[:]); err != nil {
		return nil, err
	}

	length := binary.LittleEndian.Uint32(lengthBuf[:])
	if length == 0 {
		return nil, fmt.Errorf("empty message")
	}
	if length > maxMessageSize {
		return nil, fmt.Errorf("message too large: %d bytes", length)
	}

	data := make([]byte, length)
	if _, err := io.ReadFull(r, data); err != nil {
		return nil, err
	}

	return data, nil
}

// writeMessage writes a Chrome native messaging frame.
func writeMessage(w io.Writer, payload []byte) error {
	if len(payload) > maxMessageSize {
		return fmt.Errorf("message too large: %d bytes", len(payload))
	}

	lengthBuf := make([]byte, 4)
	binary.LittleEndian.PutUint32(lengthBuf, uint32(len(payload)))

	if _, err := w.Write(lengthBuf); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}

// decodeMessage parses JSON into Message.
func decodeMessage(data []byte) (Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return Message{}, err
	}
	return msg, nil
}

// encodeMessage serializes Message to JSON.
func encodeMessage(msg Message) ([]byte, error) {
	return json.Marshal(msg)
}
