package messaging

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	utf8BOM                    = []byte{0xEF, 0xBB, 0xBF}
	chromeExtensionOriginRegex = regexp.MustCompile(`^chrome-extension://[a-p]{32}/$`)
	errPlaceholderExtensionID  = errors.New("placeholder extension id in allowed_origins")
)

// OriginGate validates the Chrome caller origin (standard native messaging security).
type OriginGate struct {
	callerOrigin   string
	allowedOrigins []string
	manifestLoaded bool
	manifestError  error
}

type hostManifest struct {
	AllowedOrigins []string `json:"allowed_origins"`
}

// NewOriginGate creates a gate from Chrome's argv origin and local host manifest.
func NewOriginGate(callerOrigin string) *OriginGate {
	allowed, err := loadAllowedOriginsFromManifest()
	return newOriginGate(strings.TrimSpace(callerOrigin), allowed, err)
}

func newOriginGate(callerOrigin string, allowed []string, manifestErr error) *OriginGate {
	g := &OriginGate{
		callerOrigin:  callerOrigin,
		manifestError: manifestErr,
	}
	if manifestErr == nil {
		g.manifestLoaded = true
		g.allowedOrigins = allowed
	}
	return g
}

func newOriginGateFromPath(callerOrigin, manifestPath string) *OriginGate {
	allowed, err := loadAllowedOriginsFromPath(manifestPath)
	return newOriginGate(strings.TrimSpace(callerOrigin), allowed, err)
}

func isValidChromeExtensionOrigin(origin string) bool {
	return chromeExtensionOriginRegex.MatchString(origin)
}

func validateAllowedOrigins(origins []string) error {
	if len(origins) == 0 {
		return nil
	}
	for _, origin := range origins {
		if strings.Contains(origin, "REPLACE_WITH_EXTENSION_ID") {
			return errPlaceholderExtensionID
		}
		if !isValidChromeExtensionOrigin(origin) {
			return fmt.Errorf("invalid allowed_origin format: %q", origin)
		}
	}
	return nil
}

func parseHostManifest(data []byte) ([]string, error) {
	data = bytes.TrimPrefix(data, utf8BOM)
	var manifest hostManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	if err := validateAllowedOrigins(manifest.AllowedOrigins); err != nil {
		return nil, err
	}
	return manifest.AllowedOrigins, nil
}

func loadAllowedOriginsFromPath(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return parseHostManifest(data)
}

func loadAllowedOriginsFromManifest() ([]string, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	return loadAllowedOriginsFromDir(filepath.Dir(exe))
}

func loadAllowedOriginsFromDir(dir string) ([]string, error) {
	localPath := filepath.Join(dir, "com.browsvpn.host.local.json")
	if _, err := os.Stat(localPath); err == nil {
		return loadAllowedOriginsFromPath(localPath)
	}
	path := filepath.Join(dir, "com.browsvpn.host.json")
	return loadAllowedOriginsFromPath(path)
}

// Allow reports whether the caller may invoke host commands (fail-closed for Chrome callers).
func (g *OriginGate) Allow() bool {
	if g == nil || g.callerOrigin == "" {
		return true
	}
	if !isValidChromeExtensionOrigin(g.callerOrigin) {
		return false
	}
	if !g.manifestLoaded || g.manifestError != nil || len(g.allowedOrigins) == 0 {
		return false
	}
	for _, origin := range g.allowedOrigins {
		if origin == g.callerOrigin {
			return true
		}
	}
	return false
}

func (g *OriginGate) CallerOrigin() string {
	if g == nil {
		return ""
	}
	return g.callerOrigin
}

func (g *OriginGate) ManifestLoaded() bool {
	if g == nil {
		return false
	}
	return g.manifestLoaded
}

func (g *OriginGate) ManifestError() error {
	if g == nil {
		return nil
	}
	return g.manifestError
}

// LoadError is kept for backward compatibility with earlier code.
func (g *OriginGate) LoadError() error {
	return g.ManifestError()
}
