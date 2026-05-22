package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"browsvpn-proxy/internal/logging"
	"browsvpn-proxy/internal/messaging"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--standalone" {
		runStandalone()
		return
	}

	runNativeMessaging()
}

func runNativeMessaging() {
	logger, err := logging.NewDefaultLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}

	handler := messaging.NewVPNHandler(logger)
	logger.Info("Brows VPN native messaging host started")

	if err := messaging.RunNativeMessagingHost(handler); err != nil {
		logger.Errorf("Native messaging error: %v", err)
		_ = handler.Stop()
		os.Exit(1)
	}

	_ = handler.Stop()
	logger.Info("Brows VPN native messaging host stopped")
}

func runStandalone() {
	logger, err := logging.NewDefaultLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}

	logger.Info("Standalone mode — system tray not yet enabled")
	logger.Info("Chrome extension launches this binary automatically via native messaging")
	logger.Info("Press Ctrl+C to exit")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
	logger.Info("Shutdown")
}
