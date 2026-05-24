package xray

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func writeTestBinary(t *testing.T, dir string, data []byte) string {
	t.Helper()
	path := filepath.Join(dir, "xray.exe")
	if err := os.WriteFile(path, data, 0600); err != nil {
		t.Fatalf("write binary: %v", err)
	}
	return path
}

func writeTestHash(t *testing.T, binaryPath string, data []byte) {
	t.Helper()
	sum := sha256.Sum256(data)
	if err := os.WriteFile(binaryPath+".sha256", []byte(hex.EncodeToString(sum[:])+"\n"), 0600); err != nil {
		t.Fatalf("write hash: %v", err)
	}
}

func TestVerifyBinaryIntegrityOptionalMissingSidecar(t *testing.T) {
	path := writeTestBinary(t, t.TempDir(), []byte("test-binary"))
	if err := VerifyBinaryIntegrity(path); err != nil {
		t.Fatalf("optional integrity should allow missing sidecar: %v", err)
	}
}

func TestVerifyBinaryIntegrityRequiredMissingSidecar(t *testing.T) {
	path := writeTestBinary(t, t.TempDir(), []byte("test-binary"))
	if err := VerifyBinaryIntegrityRequired(path); err == nil {
		t.Fatal("expected required integrity to fail without sidecar")
	}
}

func TestVerifyBinaryIntegrityRequiredValidHash(t *testing.T) {
	data := []byte("test-binary")
	path := writeTestBinary(t, t.TempDir(), data)
	writeTestHash(t, path, data)
	if err := VerifyBinaryIntegrityRequired(path); err != nil {
		t.Fatalf("expected valid hash: %v", err)
	}
}

func TestVerifyBinaryIntegrityRequiredHashMismatch(t *testing.T) {
	path := writeTestBinary(t, t.TempDir(), []byte("test-binary"))
	writeTestHash(t, path, []byte("other-binary"))
	if err := VerifyBinaryIntegrityRequired(path); err == nil {
		t.Fatal("expected hash mismatch")
	}
}
