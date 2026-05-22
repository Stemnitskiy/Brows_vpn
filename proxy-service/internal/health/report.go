package health

// ReportMap converts a report for JSON responses.
func ReportMap(r *Report) map[string]interface{} {
	checks := make([]map[string]interface{}, 0, len(r.Checks))
	for _, c := range r.Checks {
		checks = append(checks, map[string]interface{}{
			"id":      c.ID,
			"ok":      c.OK,
			"level":   c.Level,
			"message": c.Message,
		})
	}
	return map[string]interface{}{
		"ok":     r.OK,
		"checks": checks,
	}
}

// FirstError returns the first failed error-level message.
func FirstError(r *Report) string {
	for _, c := range r.Checks {
		if !c.OK && c.Level == "error" {
			return c.Message
		}
	}
	return ""
}
