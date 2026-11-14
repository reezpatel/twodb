package main

import (
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
)

// termHandle: an interactive PTY session (terminal or code-server) so the
// webapp gets a real tmux/vscode attach over the runner, not a buffered exec.
type termHandle struct {
	cmd *exec.Cmd
	pt  *os.File
	mu  sync.Mutex
}

var (
	terms   = map[string]*termHandle{}
	termsMu sync.Mutex
)

// doTermOpen: spawn `command` under a PTY and stream its output as base64
// termData frames. Reattaching to an existing session is the caller's job
// (tmux attach / a persistent server), so this always spawns fresh.
func (r *runner) doTermOpen(f frame) {
	callID := f.str("callId")
	command := f.str("command")
	if command == "" {
		_ = r.send(frame{"type": "result", "callId": callID, "error": "command required"})
		return
	}

	cmd := exec.Command("sh", "-c", command)
	if cwd := f.str("cwd"); cwd != "" {
		cmd.Dir = cwd
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	if cols := f.num("cols"); cols > 0 {
		// resized below via termResize after pty.Start
		_ = cols
	}

	pt, err := pty.Start(cmd)
	if err != nil {
		_ = r.send(frame{"type": "result", "callId": callID, "error": err.Error()})
		return
	}
	if rows := f.num("rows"); rows > 0 {
		if cols := f.num("cols"); cols > 0 {
			_ = pty.Setsize(pt, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)})
		}
	}

	termsMu.Lock()
	terms[callID] = &termHandle{cmd: cmd, pt: pt}
	termsMu.Unlock()

	// ack so the caller starts relaying
	_ = r.send(frame{"type": "result", "callId": callID, "ok": true})

	// pty -> dispatch (base64 termData frames)
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := pt.Read(buf)
			if n > 0 {
				_ = r.send(frame{"type": "termData", "callId": callID, "data": b64Encode(buf[:n])})
			}
			if err != nil {
				break
			}
		}
		termsMu.Lock()
		delete(terms, callID)
		termsMu.Unlock()
		_ = r.send(frame{"type": "termClosed", "callId": callID})
	}()
}

// doTermWrite: caller -> pty stdin (base64 data).
func (r *runner) doTermWrite(f frame) {
	callID := f.str("callId")
	termsMu.Lock()
	h := terms[callID]
	termsMu.Unlock()
	if h == nil {
		return
	}
	b, err := b64Decode(f.str("data"))
	if err != nil || len(b) == 0 {
		return
	}
	h.mu.Lock()
	_, _ = h.pt.Write(b)
	h.mu.Unlock()
}

// doTermResize: update the pty window size (xterm fit).
func (r *runner) doTermResize(f frame) {
	callID := f.str("callId")
	termsMu.Lock()
	h := terms[callID]
	termsMu.Unlock()
	if h == nil {
		return
	}
	rows, cols := f.num("rows"), f.num("cols")
	if rows > 0 && cols > 0 {
		_ = pty.Setsize(h.pt, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)})
	}
}

// doTermClose: terminate the pty session.
func (r *runner) doTermClose(f frame) {
	callID := f.str("callId")
	termsMu.Lock()
	h := terms[callID]
	delete(terms, callID)
	termsMu.Unlock()
	if h == nil {
		return
	}
	_ = h.pt.Close()
	if h.cmd.Process != nil {
		_ = h.cmd.Process.Kill()
	}
}
