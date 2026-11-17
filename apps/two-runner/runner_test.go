package main

import (
	"os"
	"path/filepath"
	"strings"
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

func TestSpawnEnvWidensPathWithNixLocations(t *testing.T) {
	// Simulate a systemd-style minimal PATH.
	t.Setenv("PATH", "/usr/bin:/bin")
	env := spawnEnv()
	var path string
	for _, e := range env {
		if strings.HasPrefix(e, "PATH=") {
			path = e[len("PATH="):]
			break
		}
	}
	for _, want := range []string{"/run/current-system/sw/bin", ".nix-profile/bin", "/usr/local/bin"} {
		if !strings.Contains(path, want) {
			t.Fatalf("PATH %q missing %q", path, want)
		}
	}
	// Nix locations must come before the minimal base so they win resolution.
	if strings.Index(path, "/run/current-system/sw/bin") > strings.Index(path, "/usr/bin") {
		t.Fatalf("nix bin should precede /usr/bin in %q", path)
	}
	// A frame-supplied env (appended after spawnEnv in buildCmd) still wins:
	// exec.Cmd honors the LAST duplicate key.
	t.Setenv("PATH", "/usr/bin:/bin")
	full := append(spawnEnv(), "PATH=/custom/bin")
	got := full[len(full)-1]
	if got != "PATH=/custom/bin" {
		t.Fatalf("frame env override should be last, got %q", got)
	}
}

func TestCommandShellFallsBackToSh(t *testing.T) {
	// Whatever it picks must be non-empty and, when bash exists on this host,
	// an absolute bash path.
	sh := commandShell()
	if sh == "" {
		t.Fatal("empty shell")
	}
	if _, err := os.Stat("/bin/bash"); err == nil && sh == "sh" {
		t.Fatalf("bash exists at /bin/bash but commandShell returned %q", sh)
	}
}
