//go:build !windows

package tray

// TrayManager is a no-op stub until platform tray support ships.
type TrayManager struct {
	enabled bool
}

// NewTrayManager creates a stub tray manager.
func NewTrayManager() *TrayManager {
	return &TrayManager{}
}

// SetCallbacks stores callbacks for API compatibility.
func (t *TrayManager) SetCallbacks(onEnable, onDisable, onQuit func()) {}

// Run is a no-op on non-Windows platforms.
func (t *TrayManager) Run() {}

// UpdateStatus is a no-op on non-Windows platforms.
func (t *TrayManager) UpdateStatus(enabled bool) {
	t.enabled = enabled
}

// Quit is a no-op on non-Windows platforms.
func (t *TrayManager) Quit() {}
