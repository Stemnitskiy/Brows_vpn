package tray

import (
	"github.com/getlantern/systray"
	"github.com/getlantern/systray/example/icon"
)

// TrayManager manages system tray icon and menu
type TrayManager struct {
	enabled bool
	onEnable func()
	onDisable func()
	onQuit func()
}

// NewTrayManager creates a new tray manager
func NewTrayManager() *TrayManager {
	return &TrayManager{
		enabled: false,
	}
}

// SetCallbacks sets the callback functions
func (t *TrayManager) SetCallbacks(onEnable, onDisable, onQuit func()) {
	t.onEnable = onEnable
	t.onDisable = onDisable
	t.onQuit = onQuit
}

// Run starts the system tray
func (t *TrayManager) Run() {
	systray.Run(t.onReady, t.onExit)
}

// onReady is called when the tray is ready
func (t *TrayManager) onReady() {
	systray.SetIcon(icon.GetIcon())
	systray.SetTitle("Brows VPN")
	systray.SetTooltip("Brows VPN - Disabled")

	// Enable/Disable menu item
	mEnable := systray.AddMenuItem("Enable VPN", "Enable VPN connection")
	mDisable := systray.AddMenuItem("Disable VPN", "Disable VPN connection")
	mDisable.Disable()

	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Quit the application")

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-mEnable.ClickedCh:
				t.enabled = true
				mEnable.Disable()
				mDisable.Enable()
				systray.SetTitle("Brows VPN - Enabled")
				systray.SetTooltip("Brows VPN - Enabled")
				if t.onEnable != nil {
					t.onEnable()
				}
			case <-mDisable.ClickedCh:
				t.enabled = false
				mDisable.Disable()
				mEnable.Enable()
				systray.SetTitle("Brows VPN - Disabled")
				systray.SetTooltip("Brows VPN - Disabled")
				if t.onDisable != nil {
					t.onDisable()
				}
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

// onExit is called when the tray is exiting
func (t *TrayManager) onExit() {
	if t.onQuit != nil {
		t.onQuit()
	}
}

// UpdateStatus updates the tray status
func (t *TrayManager) UpdateStatus(enabled bool) {
	// This would need to be implemented with proper state management
	// For now, the state is managed internally in the menu click handlers
}

// Quit quits the system tray
func (t *TrayManager) Quit() {
	systray.Quit()
}