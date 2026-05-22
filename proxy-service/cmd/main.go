package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"browsvpn-proxy/internal/logging"
	"browsvpn-proxy/internal/messaging"
	"browsvpn-proxy/internal/tray"
	"browsvpn-proxy/internal/xray"
)

func main() {
	// Initialize logger
	logger, err := logging.NewDefaultLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Close()

	logger.Info("Brows VPN Proxy Service starting...")

	// Check if running in native messaging mode (for Chrome)
	if len(os.Args) > 1 && os.Args[1] == "--native-messaging" {
		logger.Info("Running in native messaging mode")
		runNativeMessaging(logger)
		return
	}

	// Otherwise, run as standalone application with system tray
	logger.Info("Running as standalone application")
	runStandalone(logger)
}

func runNativeMessaging(logger *logging.Logger) {
	handler := messaging.NewDefaultMessageHandler()
	messaging.RunFromStdoutStdin()
}

func runStandalone(logger *logging.Logger) {
	// Create Xray controller
	xrayController := xray.NewXrayController()
	xrayController.SetOutputWriters(os.Stdout, os.Stderr)

	// Create tray manager
	trayManager := tray.NewTrayManager()

	// Set up callbacks
	trayManager.SetCallbacks(
		func() {
			// Enable VPN
			logger.Info("VPN enabled via tray")
			// Start Xray with configuration
			// xrayController.SetConfig(...)
			// xrayController.Start("xray.exe")
		},
		func() {
			// Disable VPN
			logger.Info("VPN disabled via tray")
			// Stop Xray
			xrayController.Stop()
		},
		func() {
			// Quit
			logger.Info("Application quitting")
			xrayController.Stop()
		},
	)

	// Handle OS signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Run system tray in goroutine
	go trayManager.Run()

	// Wait for quit signal
	<-sigChan
	logger.Info("Received shutdown signal")
	
	// Cleanup
	xrayController.Stop()
	trayManager.Quit()
	
	logger.Info("Brows VPN Proxy Service stopped")
}