package messaging

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// OriginGate validates the Chrome caller origin (standard native messaging security).
// Chrome passes chrome-extension://<id>/ as the first CLI argument and only connects
// extensions listed in the host manifest allowed_origins.
type OriginGate struct {
	callerOrigin   string
	allowedOrigins []string
}

type hostManifest struct {
	AllowedOrigins []string `json:"allowed_origins"`
}

// NewOriginGate creates a gate from Chrome's argv origin and local host manifest.
func NewOriginGate(callerOrigin string) *OriginGate {
	allowed, _ := loadAllowedOriginsFromManifest()
	return &OriginGate{
		callerOrigin:   strings.TrimSpace(callerOrigin),
		allowedOrigins: allowed,
	}
}

func loadAllowedOriginsFromManifest() ([]string, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(filepath.Dir(exe), "com.browsvpn.host.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var manifest hostManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	return manifest.AllowedOrigins, nil
}

// Allow reports whether the caller may invoke host commands.
func (g *OriginGate) Allow() bool {
	if g == nil || g.callerOrigin == "" {
		// Tests or non-Chrome stdin — skip (Chrome enforces allowed_origins at connect time).
		return true
	}
	if !strings.HasPrefix(g.callerOrigin, "chrome-extension://") {
		return false
	}
	if len(g.allowedOrigins) == 0 {
		return true
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
