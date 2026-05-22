//go:build !windows

package singleinstance

// Acquire is a no-op on non-Windows platforms (native messaging host targets Windows).
func Acquire() (func(), error) {
	return func() {}, nil
}
