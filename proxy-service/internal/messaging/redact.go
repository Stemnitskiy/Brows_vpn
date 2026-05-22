package messaging

import (
	"regexp"
	"strings"
)

var (
	vlessURLPattern = regexp.MustCompile(`vless://[^\s]+`)
	uuidPattern     = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)
)

func redactLogText(text string) string {
	if text == "" {
		return text
	}
	out := vlessURLPattern.ReplaceAllString(text, "vless://***")
	out = uuidPattern.ReplaceAllString(out, "********-****-****-****-************")
	lines := strings.Split(out, "\n")
	for i, line := range lines {
		if strings.Contains(line, "://") && len(line) > 120 {
			lines[i] = line[:80] + "…[redacted]"
		}
	}
	return strings.Join(lines, "\n")
}
