package health

import "testing"

func TestFindFreePortDefault(t *testing.T) {
	port, report := FindFreePort(10808)
	if port == 0 {
		t.Fatalf("expected a free port, report=%+v", report)
	}
	if IsPortExcludedOnWindows(port) {
		t.Fatalf("port %d is in Windows excluded range", port)
	}
	if !IsPortAvailable(port) {
		t.Fatalf("port %d should be available", port)
	}
}

func TestIsPortExcludedOnWindows(t *testing.T) {
	if !IsPortExcludedOnWindows(1080) {
		t.Fatal("1080 should be excluded")
	}
	if IsPortExcludedOnWindows(10808) {
		t.Fatal("10808 should not be excluded")
	}
}
