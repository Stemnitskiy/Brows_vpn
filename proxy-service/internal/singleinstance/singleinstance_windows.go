//go:build windows

package singleinstance

import (
	"fmt"
	"syscall"
	"unsafe"
)

var (
	kernel32    = syscall.NewLazyDLL("kernel32.dll")
	createMutex = kernel32.NewProc("CreateMutexW")
	closeHandle = kernel32.NewProc("CloseHandle")
)

const mutexName = "Global\\BrowsVPNNativeHost"

// Acquire returns a release function or error if another host instance holds the mutex.
func Acquire() (func(), error) {
	namePtr, err := syscall.UTF16PtrFromString(mutexName)
	if err != nil {
		return nil, err
	}

	r, _, callErr := createMutex.Call(0, 0, uintptr(unsafe.Pointer(namePtr)))
	if r == 0 {
		return nil, fmt.Errorf("create mutex: %v", callErr)
	}
	handle := syscall.Handle(r)

	if err := syscall.GetLastError(); err == syscall.ERROR_ALREADY_EXISTS {
		_, _, _ = closeHandle.Call(uintptr(handle))
		return nil, fmt.Errorf("another Brows VPN native host instance is already running")
	}

	return func() {
		_, _, _ = closeHandle.Call(uintptr(handle))
	}, nil
}
