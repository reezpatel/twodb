package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEnvOrPrefersFirstNonEmpty(t *testing.T) {
	t.Setenv("TR_A", "")
	t.Setenv("TR_B", "  b  ")
	if got := envOr("def", "TR_A", "TR_B"); got != "b" {
		t.Fatalf("got %q", got)
	}
	if got := envOr("def", "TR_MISSING"); got != "def" {
		t.Fatalf("got %q", got)
	}
}

func TestReadSecretFileTrims(t *testing.T) {
	p := filepath.Join(t.TempDir(), "tok")
	if err := os.WriteFile(p, []byte("twodbenroll_abc\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := readSecretFile(p); got != "twodbenroll_abc" {
		t.Fatalf("got %q", got)
	}
	if got := readSecretFile(""); got != "" {
		t.Fatalf("empty path should give empty secret, got %q", got)
	}
}
