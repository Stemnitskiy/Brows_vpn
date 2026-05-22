package messaging

import (
	"fmt"
	"io"
	"os"
)

// NativeMessagingHost handles Chrome native messaging over stdin/stdout.
type NativeMessagingHost struct {
	input  io.Reader
	output io.Writer
}

// NewNativeMessagingHost creates a new native messaging host.
func NewNativeMessagingHost(input io.Reader, output io.Writer) *NativeMessagingHost {
	return &NativeMessagingHost{
		input:  input,
		output: output,
	}
}

// Run reads length-prefixed messages until stdin closes.
func (h *NativeMessagingHost) Run(handler MessageHandler) error {
	for {
		data, err := readMessage(h.input)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return fmt.Errorf("read message: %w", err)
		}

		msg, err := decodeMessage(data)
		if err != nil {
			if sendErr := h.sendError("", fmt.Sprintf("Failed to parse message: %v", err)); sendErr != nil {
				return sendErr
			}
			continue
		}

		response, err := handler.HandleMessage(msg)
		if err != nil {
			if sendErr := h.sendError(msg.MessageID, fmt.Sprintf("Failed to handle message: %v", err)); sendErr != nil {
				return sendErr
			}
			continue
		}

		if err := h.sendMessage(response); err != nil {
			return fmt.Errorf("send response: %w", err)
		}
	}
}

func (h *NativeMessagingHost) sendMessage(msg Message) error {
	data, err := encodeMessage(msg)
	if err != nil {
		return err
	}
	return writeMessage(h.output, data)
}

func (h *NativeMessagingHost) sendError(messageID, errorMsg string) error {
	errorMessage := Message{
		Version:     "1.0",
		MessageType: "response",
		MessageID:   messageID,
		Payload: map[string]interface{}{
			"status": "error",
			"error": map[string]interface{}{
				"message": errorMsg,
			},
		},
	}
	return h.sendMessage(errorMessage)
}

// MessageHandler handles incoming messages.
type MessageHandler interface {
	HandleMessage(msg Message) (Message, error)
}

// Message represents a native messaging JSON payload.
type Message struct {
	Version     string                 `json:"version"`
	MessageType string                 `json:"message_type"`
	Timestamp   string                 `json:"timestamp"`
	MessageID   string                 `json:"message_id"`
	Payload     map[string]interface{} `json:"payload"`
}

// RunNativeMessagingHost runs the host on stdin/stdout until Chrome disconnects.
func RunNativeMessagingHost(handler MessageHandler) error {
	host := NewNativeMessagingHost(os.Stdin, os.Stdout)
	return host.Run(handler)
}
