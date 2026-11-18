package main

import (
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strings"
)

// Runners are often started by systemd or another minimal supervisor whose
// PATH is /usr/bin:/bin — on NixOS that lacks node, git and coreutils, so
// artisan's execs/calls/jobs fail with "command not found" (e.g. an edit
// tool needing python that lives in a nix profile). Nix user profiles
// (system packages, `nix profile`, home-manager) only enter PATH via
// profile files, which non-login `sh -c` shells never source — so the
// standard locations are listed explicitly here and prepended to every
// spawned command's environment.
func spawnEnv() []string {
	// $HOME is often overridden by the service manager (the NixOS module sets
	// HOME=/var/lib/two-runner for state), while the process still runs as the
	// real user — the passwd entry is the user's actual home, where their nix
	// profiles live. Prefer it; fall back to $HOME (then the state dir) when
	// the user isn't in passwd (containers).
	usr := os.Getenv("USER")
	home := os.Getenv("HOME")
	if u, err := user.Current(); err == nil {
		if usr == "" {
			usr = u.Username
		}
		if u.HomeDir != "" {
			home = u.HomeDir
		}
	}
	extra := []string{
		filepath.Dir(os.Args[0]),
		"/run/current-system/sw/bin",
		"/etc/profiles/per-user/" + usr + "/bin",
		filepath.Join(home, ".nix-profile/bin"),
		filepath.Join(home, ".local/state/nix/profiles/home-manager/home-path/bin"),
		"/usr/local/bin",
		"/opt/homebrew/bin",
	}
	var path string
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "PATH=") {
			path = e[len("PATH="):]
			break
		}
	}
	var parts []string
	for _, p := range append(extra, path) {
		if p != "" && p != "/bin" && p != "/usr/bin" {
			parts = append(parts, p)
		}
	}
	env := append([]string{"PATH=" + strings.Join(parts, ":")}, os.Environ()...)
	return env
}

// loginShell resolves the user's login shell for interactive terminals
// ($SHELL, else bash, else sh). Terminals spawn it as a login shell (argv0
// prefixed with "-") so profile files re-establish PATH inside the pane —
// this matters when a tmux server or another ancestor predates the runner
// and dropped its environment (non-login execs rely on spawnEnv instead).
func loginShell() string {
	if sh := os.Getenv("SHELL"); sh != "" {
		if _, err := os.Stat(sh); err == nil {
			return sh
		}
	}
	if sh := commandShell(); sh != "sh" {
		return sh
	}
	return "sh"
}

// commandShell picks the shell for `-c` spawns: prefer bash (agents write
// bashisms), fall back to plain sh. LookPath runs against the runner's own
// minimal PATH, so well-known absolute locations are probed too.
func commandShell() string {
	if p, err := exec.LookPath("bash"); err == nil {
		return p
	}
	for _, p := range []string{"/run/current-system/sw/bin/bash", "/usr/bin/bash", "/bin/bash"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "sh"
}
