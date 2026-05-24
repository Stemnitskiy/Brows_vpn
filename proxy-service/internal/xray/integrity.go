package xray

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
)

// VerifyBinaryIntegrity compares xray.exe with optional sidecar xray.exe.sha256 (hex digest).
// If the sidecar is missing, verification is skipped (dev builds).
func VerifyBinaryIntegrity(binaryPath string) error {
	return verifyBinaryIntegrity(binaryPath, false)
}

// VerifyBinaryIntegrityRequired compares xray.exe with a required xray.exe.sha256 sidecar.
func VerifyBinaryIntegrityRequired(binaryPath string) error {
	return verifyBinaryIntegrity(binaryPath, true)
}

func verifyBinaryIntegrity(binaryPath string, requireSidecar bool) error {
	sumPath := binaryPath + ".sha256"
	data, err := os.ReadFile(sumPath)
	if err != nil {
		if os.IsNotExist(err) {
			if requireSidecar {
				return fmt.Errorf("xray integrity file missing: %s", sumPath)
			}
			return nil
		}
		return fmt.Errorf("read integrity file: %w", err)
	}

	expected := strings.TrimSpace(string(data))
	if idx := strings.Index(expected, " "); idx >= 0 {
		expected = expected[:idx]
	}
	expected = strings.ToLower(expected)

	raw, err := os.ReadFile(binaryPath)
	if err != nil {
		return fmt.Errorf("read xray binary: %w", err)
	}
	sum := sha256.Sum256(raw)
	actual := hex.EncodeToString(sum[:])
	if subtleCompareHex(actual, expected) {
		return nil
	}
	return fmt.Errorf("xray.exe integrity check failed (hash mismatch)")
}

func subtleCompareHex(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := 0; i < len(a); i++ {
		v |= a[i] ^ b[i]
	}
	return v == 0
}
