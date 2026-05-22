package health

import "fmt"

const (
	defaultFreePortStart  = 10808
	maxPortSearchAttempts = 120
)

// IsPortExcludedOnWindows reports ports blocked by Windows (1068–1167).
func IsPortExcludedOnWindows(port int) bool {
	return port >= 1068 && port <= 1167
}

// IsPortAvailable returns true if the port can be used for local SOCKS.
func IsPortAvailable(port int) bool {
	if port <= 0 || port > 65535 {
		return false
	}
	if IsPortExcludedOnWindows(port) {
		return false
	}
	if IsPortListening("127.0.0.1", port) {
		return false
	}
	return checkPortBindable(port) == nil
}

// FindFreePort searches for a bindable local port, starting from preferred.
func FindFreePort(preferred int) (int, *Report) {
	report := NewReport()
	if preferred <= 0 || preferred > 65535 {
		preferred = defaultFreePortStart
	}

	tried := 0
	searchFrom := func(start, end int) int {
		for port := start; port <= end && tried < maxPortSearchAttempts; port++ {
			if IsPortExcludedOnWindows(port) {
				continue
			}
			tried++
			if IsPortAvailable(port) {
				report.add("free_port", "info", fmt.Sprintf("Найден свободный порт %d", port), true)
				return port
			}
		}
		return 0
	}

	if port := searchFrom(preferred, 65535); port != 0 {
		return port, report
	}
	if preferred > defaultFreePortStart {
		if port := searchFrom(defaultFreePortStart, preferred-1); port != 0 {
			return port, report
		}
	}

	report.add("free_port", "error", "Не удалось найти свободный порт", false)
	return 0, report
}
