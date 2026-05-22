package xray

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

// XrayController manages Xray-core process
type XrayController struct {
	cmd       *exec.Cmd
	config    map[string]interface{}
	configPath string
	running   bool
	mu        sync.Mutex
	stdout    io.Writer
	stderr    io.Writer
}

// NewXrayController creates a new Xray controller
func NewXrayController() *XrayController {
	return &XrayController{
		running: false,
		stdout: os.Stdout,
		stderr: os.Stderr,
	}
}

// SetOutputWriters sets the writers for stdout and stderr
func (x *XrayController) SetOutputWriters(stdout, stderr io.Writer) {
	x.mu.Lock()
	defer x.mu.Unlock()
	x.stdout = stdout
	x.stderr = stderr
}

// SetConfig sets the Xray configuration
func (x *XrayController) SetConfig(config map[string]interface{}) error {
	x.mu.Lock()
	defer x.mu.Unlock()
	x.config = config
	return nil
}

// SetConfigPath sets the path to Xray config file
func (x *XrayController) SetConfigPath(path string) error {
	x.mu.Lock()
	defer x.mu.Unlock()
	x.configPath = path
	return nil
}

// GenerateConfigFile generates Xray config file
func (x *XrayController) GenerateConfigFile() error {
	x.mu.Lock()
	defer x.mu.Unlock()

	if x.config == nil {
		return fmt.Errorf("no configuration set")
	}

	configPath := x.configPath
	if configPath == "" {
		configPath = filepath.Join(os.TempDir(), "xray-config.json")
	}

	configData, err := json.MarshalIndent(x.config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, configData, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	x.configPath = configPath
	return nil
}

// Start starts the Xray-core process
func (x *XrayController) Start(xrayPath string) error {
	x.mu.Lock()
	defer x.mu.Unlock()

	if x.running {
		return fmt.Errorf("Xray is already running")
	}

	// Ensure config file exists
	if x.configPath == "" {
		if err := x.GenerateConfigFile(); err != nil {
			return err
		}
	}

	// Create command
	x.cmd = exec.Command(xrayPath, "-c", x.configPath)
	x.cmd.Stdout = x.stdout
	x.cmd.Stderr = x.stderr

	// Start process
	if err := x.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start Xray: %w", err)
	}

	x.running = true
	return nil
}

// Stop stops the Xray-core process
func (x *XrayController) Stop() error {
	x.mu.Lock()
	defer x.mu.Unlock()

	if !x.running {
		return nil
	}

	if x.cmd != nil && x.cmd.Process != nil {
		if err := x.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("failed to kill Xray process: %w", err)
		}
	}

	x.running = false
	x.cmd = nil
	return nil
}

// Restart restarts the Xray-core process
func (x *XrayController) Restart(xrayPath string) error {
	if err := x.Stop(); err != nil {
		return err
	}
	return x.Start(xrayPath)
}

// IsRunning returns whether Xray is running
func (x *XrayController) IsRunning() bool {
	x.mu.Lock()
	defer x.mu.Unlock()
	return x.running
}

// GetConfigPath returns the current config path
func (x *XrayController) GetConfigPath() string {
	x.mu.Lock()
	defer x.mu.Unlock()
	return x.configPath
}