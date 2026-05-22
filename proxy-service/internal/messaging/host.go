package messaging

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// Message represents a message in the native messaging protocol
type Message struct {
	Version     string                 `json:"version"`
	MessageType string                 `json:"message_type"`
	Timestamp   string                 `json:"timestamp"`
	MessageID   string                 `json:"message_id"`
	Payload     map[string]interface{} `json:"payload"`
}

// NativeMessagingHost handles Chrome native messaging protocol
type NativeMessagingHost struct {
	input  io.Reader
	output io.Writer
}

// NewNativeMessagingHost creates a new native messaging host
func NewNativeMessagingHost(input io.Reader, output io.Writer) *NativeMessagingHost {
	return &NativeMessagingHost{
		input:  input,
		output: output,
	}
}

// Run starts the native messaging host
func (h *NativeMessagingHost) Run(handler MessageHandler) error {
	scanner := bufio.NewScanner(h.input)
	
	for scanner.Scan() {
		messageStr := scanner.Text()
		
		var msg Message
		if err := json.Unmarshal([]byte(messageStr), &msg); err != nil {
			h.sendError(fmt.Sprintf("Failed to parse message: %v", err))
			continue
		}
		
		// Handle the message
		response, err := handler.HandleMessage(msg)
		if err != nil {
			h.sendError(fmt.Sprintf("Failed to handle message: %v", err))
			continue
		}
		
		// Send response
		if err := h.sendMessage(response); err != nil {
			return fmt.Errorf("failed to send response: %w", err)
		}
	}
	
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scanner error: %w", err)
	}
	
	return nil
}

// sendMessage sends a message to the extension
func (h *NativeMessagingHost) sendMessage(msg Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	
	_, err = h.output.Write(data)
	return err
}

// sendError sends an error message
func (h *NativeMessagingHost) sendError(errorMsg string) {
	errorMsg := Message{
		Version:     "1.0",
		MessageType: "response",
		Payload: map[string]interface{}{
			"status": "error",
			"error": map[string]interface{}{
				"message": errorMsg,
			},
		},
	}
	h.sendMessage(errorMsg)
}

// MessageHandler handles incoming messages
type MessageHandler interface {
	HandleMessage(msg Message) (Message, error)
}

// DefaultMessageHandler provides default message handling
type DefaultMessageHandler struct {
	// Add state management fields here
	vlessConfig string
	enabled     bool
}

// NewDefaultMessageHandler creates a new default message handler
func NewDefaultMessageHandler() *DefaultMessageHandler {
	return &DefaultMessageHandler{
		enabled: false,
	}
}

// HandleMessage processes incoming messages
func (h *DefaultMessageHandler) HandleMessage(msg Message) (Message, error) {
	switch msg.MessageType {
	case "command":
		return h.handleCommand(msg)
	default:
		return Message{
			Version:     "1.0",
			MessageType: "response",
			Payload: map[string]interface{}{
				"status": "error",
				"error": map[string]interface{}{
					"message": "Unknown message type",
				},
			},
		}, nil
	}
}

func (h *DefaultMessageHandler) handleCommand(msg Message) (Message, error) {
	command, ok := msg.Payload["command"].(string)
	if !ok {
		return Message{}, fmt.Errorf("missing command in payload")
	}

	switch command {
	case "enable_vpn":
		return h.handleEnableVPN(msg)
	case "disable_vpn":
		return h.handleDisableVPN()
	case "get_status":
		return h.handleGetStatus()
	default:
		return Message{
			Version:     "1.0",
			MessageType: "response",
			Payload: map[string]interface{}{
				"status": "error",
				"error": map[string]interface{}{
					"message": "Unknown command: " + command,
				},
			},
		}, nil
	}
}

func (h *DefaultMessageHandler) handleEnableVPN(msg Message) (Message, error) {
	config, ok := msg.Payload["config"].(map[string]interface{})
	if !ok {
		return Message{}, fmt.Errorf("missing config in payload")
	}

	vlessURL, ok := config["vless_url"].(string)
	if !ok {
		return Message{}, fmt.Errorf("missing vless_url in config")
	}

	h.vlessConfig = vlessURL
	h.enabled = true

	return Message{
		Version:     "1.0",
		MessageType: "response",
		Payload: map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"vpn_status": "enabled",
				"config_id":  "config_001",
			},
		},
	}, nil
}

func (h *DefaultMessageHandler) handleDisableVPN() (Message, error) {
	h.enabled = false
	h.vlessConfig = ""

	return Message{
		Version:     "1.0",
		MessageType: "response",
		Payload: map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"vpn_status": "disabled",
			},
		},
	}, nil
}

func (h *DefaultMessageHandler) handleGetStatus() (Message, error) {
	status := "disabled"
	if h.enabled {
		status = "enabled"
	}

	return Message{
		Version:     "1.0",
		MessageType: "response",
		Payload: map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"vpn_status": status,
				"config":     h.vlessConfig,
			},
		},
	}, nil
}

// RunFromStdoutStdin runs the host using stdin/stdout (for Chrome native messaging)
func RunFromStdoutStdin() {
	host := NewNativeMessagingHost(os.Stdin, os.Stdout)
	handler := NewDefaultMessageHandler()
	
	if err := host.Run(handler); err != nil {
		fmt.Fprintf(os.Stderr, "Native messaging error: %v\n", err)
		os.Exit(1)
	}
}