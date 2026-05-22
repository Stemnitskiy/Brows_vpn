package xray

import (
	"fmt"
	"os"
	"path/filepath"
)

// ResolveBinaryPath returns the path to xray.exe relative to the running executable.
func ResolveBinaryPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("resolve executable: %w", err)
	}

	path := filepath.Join(filepath.Dir(exe), "xray-core", "xray.exe")
	if _, err := os.Stat(path); err != nil {
		return "", fmt.Errorf("xray binary not found at %s: %w", path, err)
	}

	return path, nil
}

// ResolveWorkDir returns the directory containing xray.exe and geo data files.
func ResolveWorkDir() (string, error) {
	binaryPath, err := ResolveBinaryPath()
	if err != nil {
		return "", err
	}
	return filepath.Dir(binaryPath), nil
}
