package vless

import (
	"fmt"
	"net/url"
	"strings"
)

// VLESSConfig represents parsed VLESS configuration
type VLESSConfig struct {
	UUID         string
	Address      string
	Port         int
	Type         string
	Encryption   string
	ServiceName  string
	Authority    string
	Security     string
	PublicKey    string
	Fingerprint  string
	SNI          string
	ShortID      string
	SPIX         string
	Name         string
}

// ParseVLESSURL parses VLESS URL format
// Format: vless://uuid@address:port?type=grpc&encryption=none&serviceName=vpn&security=reality&pbk=publicKey&fp=chrome&sni=serverName&sid=sessionId&spx=%2F#name
func ParseVLESSURL(vlessURL string) (*VLESSConfig, error) {
	if !strings.HasPrefix(vlessURL, "vless://") {
		return nil, fmt.Errorf("invalid VLESS URL format")
	}

	// Remove vless:// prefix
	urlStr := strings.TrimPrefix(vlessURL, "vless://")
	
	// Split fragment
	parts := strings.Split(urlStr, "#")
	configPart := parts[0]
	name := ""
	if len(parts) > 1 {
		name = parts[1]
	}

	// Parse URL
	u, err := url.Parse("vless://" + configPart)
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %v", err)
	}

	// Extract UUID and address
	userInfo := u.User
	if userInfo == nil {
		return nil, fmt.Errorf("missing UUID in URL")
	}

	uuid := userInfo.Username()
	if uuid == "" {
		return nil, fmt.Errorf("empty UUID")
	}

	host := u.Hostname()
	if host == "" {
		return nil, fmt.Errorf("missing address in URL")
	}

	port := 443 // default
	if u.Port() != "" {
		_, err := fmt.Sscanf(u.Port(), "%d", &port)
		if err != nil {
			return nil, fmt.Errorf("invalid port: %v", err)
		}
	}

	// Parse query parameters
	query := u.Query()

	config := &VLESSConfig{
		UUID:    uuid,
		Address: host,
		Port:    port,
		Name:    name,
		Type:    query.Get("type"),
	}

	// Set defaults
	if config.Type == "" {
		config.Type = "tcp" // default transport
	}

	// Parse optional parameters
	config.Encryption = query.Get("encryption")
	if config.Encryption == "" {
		config.Encryption = "none" // default for Reality
	}

	config.ServiceName = query.Get("serviceName")
	config.Authority = query.Get("authority")
	config.Security = query.Get("security")
	config.PublicKey = query.Get("pbk")
	config.Fingerprint = query.Get("fp")
	config.SNI = query.Get("sni")
	config.ShortID = query.Get("sid")
	config.SPIX = query.Get("spx")

	// Validate required parameters
	if config.Security == "reality" && config.PublicKey == "" {
		return nil, fmt.Errorf("public key (pbk) is required for Reality security")
	}

	if config.Security == "reality" && config.SNI == "" {
		return nil, fmt.Errorf("SNI is required for Reality security")
	}

	return config, nil
}

// Validate checks if the VLESS configuration is valid
func (c *VLESSConfig) Validate() error {
	if c.UUID == "" {
		return fmt.Errorf("UUID is required")
	}

	if c.Address == "" {
		return fmt.Errorf("address is required")
	}

	if c.Port <= 0 || c.Port > 65535 {
		return fmt.Errorf("invalid port: %d", c.Port)
	}

	if c.Security == "reality" {
		if c.PublicKey == "" {
			return fmt.Errorf("public key is required for Reality security")
		}
		if c.SNI == "" {
			return fmt.Errorf("SNI is required for Reality security")
		}
	}

	if c.Type == "grpc" && c.ServiceName == "" {
		return fmt.Errorf("service name is required for gRPC transport")
	}

	return nil
}

// ToXrayConfig converts VLESS config to Xray-core configuration format.
func (c *VLESSConfig) ToXrayConfig(socksPort int) map[string]interface{} {
	if socksPort <= 0 {
		socksPort = 10808
	}

	return map[string]interface{}{
		"log": map[string]interface{}{
			"loglevel": "info",
			"access":   "access.log",
			"error":    "error.log",
		},
		"inbounds": []map[string]interface{}{
			{
				"tag":      "socks-in",
				"protocol": "socks",
				"listen":   "127.0.0.1",
				"port":     socksPort,
				"settings": map[string]interface{}{
					"auth": "noauth",
					"udp":  true,
				},
			},
		},
		"outbounds": []map[string]interface{}{
			{
				"tag":      "proxy",
				"protocol": "vless",
				"settings": map[string]interface{}{
					"vnext": []map[string]interface{}{
						{
							"address": c.Address,
							"port":    c.Port,
							"users": []map[string]interface{}{
								{
									"id":         c.UUID,
									"encryption": c.Encryption,
								},
							},
						},
					},
				},
				"streamSettings": c.buildStreamSettings(),
			},
			{
				"protocol": "freedom",
				"tag":      "direct",
			},
		},
		"routing": map[string]interface{}{
			"domainStrategy": "AsIs",
			"rules": []map[string]interface{}{
				{
					"type":        "field",
					"ip":          []string{"geoip:private"},
					"outboundTag": "direct",
				},
				{
					"type":        "field",
					"inboundTag":  []string{"socks-in"},
					"outboundTag": "proxy",
				},
			},
		},
	}
}

func (c *VLESSConfig) buildStreamSettings() map[string]interface{} {
	settings := map[string]interface{}{
		"network": c.Type,
	}

	switch c.Security {
	case "reality":
		settings["security"] = "reality"
		realitySettings := map[string]interface{}{
			"show":        false,
			"serverName":  c.SNI,
			"password":    c.PublicKey,
			"fingerprint": defaultFingerprint(c.Fingerprint),
		}
		if c.ShortID != "" {
			realitySettings["shortId"] = c.ShortID
		}
		if c.SPIX != "" {
			realitySettings["spiderX"] = c.SPIX
		}
		settings["realitySettings"] = realitySettings
	case "tls":
		settings["security"] = "tls"
		tlsSettings := map[string]interface{}{
			"serverName":    c.SNI,
			"allowInsecure": false,
		}
		if c.Fingerprint != "" {
			tlsSettings["fingerprint"] = c.Fingerprint
		}
		settings["tlsSettings"] = tlsSettings
	}

	if c.Type == "grpc" {
		grpcSettings := map[string]interface{}{
			"serviceName": c.ServiceName,
		}
		if c.Authority != "" {
			grpcSettings["authority"] = c.Authority
		}
		settings["grpcSettings"] = grpcSettings
	}

	return settings
}

func defaultFingerprint(fp string) string {
	if fp == "" {
		return "chrome"
	}
	return fp
}