package messaging

import "testing"

func TestOriginGateAllowListed(t *testing.T) {
	g := &OriginGate{
		callerOrigin:   "chrome-extension://abcdefghijklmnop/",
		allowedOrigins: []string{"chrome-extension://abcdefghijklmnop/"},
	}
	if !g.Allow() {
		t.Fatal("expected allowed origin")
	}
}

func TestOriginGateRejectUnknown(t *testing.T) {
	g := &OriginGate{
		callerOrigin:   "chrome-extension://wrongid/",
		allowedOrigins: []string{"chrome-extension://abcdefghijklmnop/"},
	}
	if g.Allow() {
		t.Fatal("expected rejected origin")
	}
}

func TestOriginGateEmptyCallerForTests(t *testing.T) {
	g := &OriginGate{allowedOrigins: []string{"chrome-extension://a/"}}
	if !g.Allow() {
		t.Fatal("empty caller should pass for non-Chrome pipes")
	}
}
