package xray

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// XrayController manages Xray-core process.
type XrayController struct {
	cmd        *exec.Cmd
	config     map[string]interface{}
	configPath string
	running    bool
	mu         sync.Mutex
	stdout     io.Writer
	stderr     io.Writer
}

// NewXrayController creates a new Xray controller.
func NewXrayController() *XrayController {
	return &XrayController{
		running: false,
		stdout:  io.Discard,
		stderr:  io.Discard,
	}
}

// SetOutputWriters sets writers for Xray stdout/stderr.
func (x *XrayController) SetOutputWriters(stdout, stderr io.Writer) {
	x.mu.Lock()
	defer x.mu.Unlock()
	x.stdout = stdout
	x.stderr = stderr
}

// SetConfig sets the Xray configuration map.
func (x *XrayController) SetConfig(config map[string]interface{}) error {
	x.mu.Lock()
	defer x.mu.Unlock()
	x.config = config
	return nil
}

// WriteConfigFile writes the config next to xray binary and returns its path.
func (x *XrayController) WriteConfigFile(workDir string) (string, error) {
	x.mu.Lock()
	defer x.mu.Unlock()

	if x.config == nil {
		return "", fmt.Errorf("no configuration set")
	}

	configPath := filepath.Join(workDir, "xray-config.json")
	configData, err := json.MarshalIndent(x.config, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal config: %w", err)
	}

	if err := os.WriteFile(configPath, configData, 0644); err != nil {
		return "", fmt.Errorf("write config file: %w", err)
	}

	x.configPath = configPath
	return configPath, nil
}

// Start starts Xray in workDir so geoip/geosite dat files resolve correctly.
func (x *XrayController) Start(xrayPath, workDir, configPath string) error {
	x.mu.Lock()
	defer x.mu.Unlock()

	if x.running {
		return fmt.Errorf("xray is already running")
	}

	if configPath == "" {
		return fmt.Errorf("config path is required")
	}

	x.cmd = exec.Command(xrayPath, "run", "-c", configPath)
	x.cmd.Dir = workDir
	x.cmd.Stdout = x.stdout
	x.cmd.Stderr = x.stderr

	if err := x.cmd.Start(); err != nil {
		return fmt.Errorf("start xray: %w", err)
	}

	x.running = true
	x.configPath = configPath

	done := make(chan error, 1)
	go func() {
		done <- x.cmd.Wait()
	}()

	select {
	case err := <-done:
		x.running = false
		x.cmd = nil
		if err != nil {
			return fmt.Errorf("xray exited on start: %w", err)
		}
		return fmt.Errorf("xray exited on start")
	case <-time.After(400 * time.Millisecond):
	}

	return nil
}

// Stop stops the Xray process.
func (x *XrayController) Stop() error {
	x.mu.Lock()
	defer x.mu.Unlock()

	if !x.running {
		return nil
	}

	if x.cmd != nil && x.cmd.Process != nil {
		if err := x.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("kill xray: %w", err)
		}
		_ = x.cmd.Wait()
	}

	x.running = false
	x.cmd = nil
	return nil
}

// IsRunning reports whether Xray is running.
func (x *XrayController) IsRunning() bool {
	x.mu.Lock()
	defer x.mu.Unlock()

	if !x.running || x.cmd == nil || x.cmd.Process == nil {
		return false
	}

	// ProcessState is set after Wait(); nil means still running.
	return x.cmd.ProcessState == nil
}

// GetConfigPath returns the active config file path.
func (x *XrayController) GetConfigPath() string {
	x.mu.Lock()
	defer x.mu.Unlock()
	return x.configPath
}
