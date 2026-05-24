package messaging

import (
	"os"
	"path/filepath"
	"testing"
)

const testExtensionID = "abcdefghijklmnopabcdefghijklmnop"
const testExtensionOrigin = "chrome-extension://" + testExtensionID + "/"
const otherExtensionOrigin = "chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/"

func writeManifest(t *testing.T, dir, content string) string {
	t.Helper()
	path := filepath.Join(dir, "com.browsvpn.host.json")
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
	return path
}

func TestParseHostManifestBOM(t *testing.T) {
	body := `{"allowed_origins":["` + testExtensionOrigin + `"]}`
	data := append(append([]byte(nil), utf8BOM...), body...)
	origins, err := parseHostManifest(data)
	if err != nil {
		t.Fatalf("parseHostManifest: %v", err)
	}
	if len(origins) != 1 || origins[0] != testExtensionOrigin {
		t.Fatalf("unexpected origins: %v", origins)
	}
}

func TestOriginGateMalformedManifestRejectChromeCaller(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{not json`)
	g := newOriginGateFromPath(testExtensionOrigin, path)
	if g.Allow() {
		t.Fatal("expected reject for malformed manifest with chrome caller")
	}
	if g.ManifestLoaded() {
		t.Fatal("expected manifestLoaded=false")
	}
	if g.ManifestError() == nil {
		t.Fatal("expected manifest error")
	}
}

func TestOriginGateMissingManifestRejectChromeCaller(t *testing.T) {
	g := newOriginGateFromPath(testExtensionOrigin, filepath.Join(t.TempDir(), "missing.json"))
	if g.Allow() {
		t.Fatal("expected reject when manifest missing")
	}
	if g.ManifestLoaded() {
		t.Fatal("expected manifestLoaded=false")
	}
}

func TestOriginGateEmptyAllowedOriginsRejectChromeCaller(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{"allowed_origins":[]}`)
	g := newOriginGateFromPath(testExtensionOrigin, path)
	if g.Allow() {
		t.Fatal("expected reject for empty allowed_origins with chrome caller")
	}
}

func TestOriginGatePlaceholderAllowedOriginsRejectChromeCaller(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{"allowed_origins":["chrome-extension://REPLACE_WITH_EXTENSION_ID/"]}`)
	g := newOriginGateFromPath(testExtensionOrigin, path)
	if g.Allow() {
		t.Fatal("expected reject for placeholder allowed_origins with chrome caller")
	}
	if g.ManifestError() == nil {
		t.Fatal("expected manifest error for placeholder")
	}
}

func TestOriginGateListedChromeCallerAllow(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{"allowed_origins":["`+testExtensionOrigin+`"]}`)
	g := newOriginGateFromPath(testExtensionOrigin, path)
	if !g.Allow() {
		t.Fatal("expected allowed listed chrome caller")
	}
}

func TestOriginGateUnknownChromeCallerReject(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{"allowed_origins":["`+testExtensionOrigin+`"]}`)
	g := newOriginGateFromPath(otherExtensionOrigin, path)
	if g.Allow() {
		t.Fatal("expected reject unknown chrome caller")
	}
}

func TestOriginGateInvalidChromeCallerFormatReject(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{"allowed_origins":["`+testExtensionOrigin+`"]}`)
	g := newOriginGateFromPath("chrome-extension://tooshort/", path)
	if g.Allow() {
		t.Fatal("expected reject invalid chrome caller format")
	}
}

func TestOriginGateEmptyCallerAllow(t *testing.T) {
	dir := t.TempDir()
	path := writeManifest(t, dir, `{"allowed_origins":["`+testExtensionOrigin+`"]}`)
	g := newOriginGateFromPath("", path)
	if !g.Allow() {
		t.Fatal("empty caller should pass for non-Chrome pipes")
	}
}

func TestLoadAllowedOriginsPrefersLocalManifest(t *testing.T) {
	dir := t.TempDir()
	writeManifest(t, dir, `{"allowed_origins":["`+otherExtensionOrigin+`"]}`)
	localPath := filepath.Join(dir, "com.browsvpn.host.local.json")
	if err := os.WriteFile(localPath, []byte(`{"allowed_origins":["`+testExtensionOrigin+`"]}`), 0600); err != nil {
		t.Fatalf("write local manifest: %v", err)
	}

	origins, err := loadAllowedOriginsFromDir(dir)
	if err != nil {
		t.Fatalf("loadAllowedOriginsFromDir: %v", err)
	}
	if len(origins) != 1 || origins[0] != testExtensionOrigin {
		t.Fatalf("expected local manifest origin, got %v", origins)
	}
}
