package vless

import (
	"encoding/json"
	"strings"
	"testing"
)

const testVLESSURL = "vless://550e8400-e29b-41d4-a716-446655440000@vpn.example.com:443" +
	"?type=grpc&encryption=none&serviceName=vpn&security=reality" +
	"&pbk=TEST_PUBLIC_KEY&fp=chrome&sni=example.com&sid=abcd&spx=%2F#TestProfile"

func TestParseVLESSURL(t *testing.T) {
	cfg, err := ParseVLESSURL(testVLESSURL)
	if err != nil {
		t.Fatalf("ParseVLESSURL: %v", err)
	}

	if cfg.UUID != "550e8400-e29b-41d4-a716-446655440000" {
		t.Fatalf("uuid mismatch: %s", cfg.UUID)
	}
	if cfg.Address != "vpn.example.com" || cfg.Port != 443 {
		t.Fatalf("address/port mismatch: %s:%d", cfg.Address, cfg.Port)
	}
	if cfg.Type != "grpc" || cfg.Security != "reality" {
		t.Fatalf("transport/security mismatch")
	}
	if cfg.ServiceName != "vpn" || cfg.PublicKey != "TEST_PUBLIC_KEY" {
		t.Fatalf("grpc/reality params mismatch")
	}
	if cfg.Name != "TestProfile" {
		t.Fatalf("name mismatch: %s", cfg.Name)
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}
}

func TestToXrayConfigRealityClient(t *testing.T) {
	cfg, err := ParseVLESSURL(testVLESSURL)
	if err != nil {
		t.Fatalf("ParseVLESSURL: %v", err)
	}

	xrayCfg := cfg.ToXrayConfig(1080)
	data, err := json.MarshalIndent(xrayCfg, "", "  ")
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	raw := string(data)
	if strings.Contains(raw, "privateKey") {
		t.Fatalf("client config must not contain privateKey")
	}
	if strings.Contains(raw, "shortIds") {
		t.Fatalf("client config must not contain shortIds")
	}
  if !strings.Contains(raw, `"password"`) {
		t.Fatalf("client config must contain password (Xray 26+ Reality client field)")
	}
	if strings.Contains(raw, `"inboundTag"`) && strings.Contains(raw, `"socks-in"`) {
		// routing rule present
	} else {
		t.Fatalf("client config must route socks-in to proxy outbound")
	}
	if !strings.Contains(raw, `"shortId"`) {
		t.Fatalf("client config must contain shortId")
	}
}
