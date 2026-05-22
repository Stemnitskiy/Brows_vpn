package messaging

import (
	"bufio"
	"os"
	"strings"
)

func tailFile(path string, maxLines int) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		if len(lines) > maxLines {
			lines = lines[1:]
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return lines, nil
}

func joinLines(lines []string) string {
	if len(lines) == 0 {
		return "(empty)"
	}
	return strings.Join(lines, "\n")
}
