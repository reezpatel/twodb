package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
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
	// HOME=/var/lib/two-runner for state) and the unit sets no $USER — worse,
	// the release build is CGO_ENABLED=0, where user.Current() errors with
	// "user: Current requires cgo". Resolve the uid from /proc/self/loginuid
	// and parse /etc/passwd by hand so the real user's home (nix profiles,
	// dotfiles) is found without cgo. Falls back to $USER/$HOME (containers).
	usr := os.Getenv("USER")
	home := os.Getenv("HOME")
	if name, dir := passwdLookup(); name != "" {
		if usr == "" {
			usr = name
		}
		if dir != "" {
			home = dir
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
	inherited := make([]string, 0, len(os.Environ()))
	for _, e := range os.Environ() {
		// The exec syscall keeps the LAST duplicate key — drop the inherited
		// PATH so our widened PATH above actually reaches the child.
		if !strings.HasPrefix(e, "PATH=") {
			inherited = append(inherited, e)
		}
	}
	env := append([]string{"PATH=" + strings.Join(parts, ":")}, inherited...)
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

// passwdLookup resolves the invoking user's name + home without cgo (the
// release build is CGO_ENABLED=0, where os/user.Current errors). The uid
// comes from /proc/self/loginuid (survives sudo/su) or, when unset there
// (4294967295), from getuid — a systemd service's uid is the real user's
// either way. /etc/passwd is parsed by hand. "" when unavailable (non-Linux,
// containers) — spawnEnv then falls back to $USER/$HOME.
func passwdLookup() (name, home string) {
	uid := ""
	if raw, err := os.ReadFile("/proc/self/loginuid"); err == nil {
		if v := strings.TrimSpace(string(raw)); v != "" && v != "4294967295" {
			uid = v
		}
	}
	if uid == "" {
		uid = strconv.Itoa(os.Getuid())
	}
	passwd, err := os.ReadFile("/etc/passwd")
	if err != nil {
		return "", ""
	}
	for _, line := range strings.Split(string(passwd), "\n") {
		f := strings.Split(line, ":")
		if len(f) >= 6 && f[2] == uid {
			return f[0], f[5]
		}
	}
	return "", ""
}
