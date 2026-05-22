package logging

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Logger wraps logrus logger
type Logger struct {
	*logrus.Logger
}

// Config holds logger configuration
type Config struct {
	Level      string
	OutputPath string
	MaxSize    int  // MB
	MaxBackups int
	MaxAge     int  // days
	Compress   bool
}

// DefaultConfig returns default logger configuration
func DefaultConfig() *Config {
	return &Config{
		Level:      "info",
		OutputPath: "logs/app.log",
		MaxSize:    100, // 100 MB
		MaxBackups: 3,
		MaxAge:     28, // 28 days
		Compress:   true,
	}
}

// NewLogger creates a new logger with the given configuration
func NewLogger(config *Config) (*Logger, error) {
	if config == nil {
		config = DefaultConfig()
	}

	log := logrus.New()
	
	// Set log level
	level, err := logrus.ParseLevel(config.Level)
	if err != nil {
		return nil, fmt.Errorf("invalid log level: %w", err)
	}
	log.SetLevel(level)

	// Create logs directory if it doesn't exist
	logDir := filepath.Dir(config.OutputPath)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create log directory: %w", err)
	}

	// Set up log rotation
	log.SetOutput(&lumberjack.Logger{
		Filename:   config.OutputPath,
		MaxSize:    config.MaxSize,
		MaxBackups: config.MaxBackups,
		MaxAge:     config.MaxAge,
		Compress:   config.Compress,
	})

	// Set formatter
	log.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: "2006-01-02 15:04:05",
	})

	return &Logger{Logger: log}, nil
}

// NewDefaultLogger creates a logger with default configuration
func NewDefaultLogger() (*Logger, error) {
	return NewLogger(DefaultConfig())
}