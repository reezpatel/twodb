package main

import (
	"strings"
	"os"
	"os/exec"
	"bytes"
	"fmt"
	"net/http"
	"sync"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
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

// --- code-server HTTP proxy -------------------------------------------------

// doProxyHttp: proxy one HTTP request to a localhost port (code-server) and
// stream the response back as proxyHttpResponse/Chunk/End frames. Ack the callId
// first so dispatch's sendToRunner resolves, then stream the body.
func (r *runner) doProxyHttp(f frame) {
	callID := f.str("callId")
	port := f.num("port")
	if port <= 0 {
		_ = r.send(frame{"type": "result", "callId": callID, "ok": true})
		_ = r.send(frame{"type": "proxyHttpResponse", "callId": callID, "status": 502, "headers": map[string]string{}})
		_ = r.send(frame{"type": "proxyHttpEnd", "callId": callID, "error": "bad port"})
		return
	}
	_ = r.send(frame{"type": "result", "callId": callID, "ok": true})
	method := f.str("method")
	if method == "" {
		method = "GET"
	}
	path := f.str("path")
	if path == "" {
		path = "/"
	}
	url := "http://127.0.0.1:" + itoa(port) + path

	var body []byte
	if b64, ok := f["bodyBase64"].(string); ok && b64 != "" {
		b, err := b64Decode(b64)
		if err == nil {
			body = b
		}
	}
	req, err := http.NewRequest(method, url, bytesReader(body))
	if err != nil {
		_ = r.send(frame{"type": "proxyHttpResponse", "callId": callID, "status": 502, "headers": map[string]string{}})
		_ = r.send(frame{"type": "proxyHttpEnd", "callId": callID, "error": err.Error()})
		return
	}
	if headers, ok := f["headers"].(map[string]any); ok {
		for k, v := range headers {
			req.Header.Set(k, fmt.Sprint(v))
		}
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		_ = r.send(frame{"type": "proxyHttpResponse", "callId": callID, "status": 502, "headers": map[string]string{}})
		_ = r.send(frame{"type": "proxyHttpEnd", "callId": callID, "error": err.Error()})
		return
	}
	defer res.Body.Close()

	hdr := map[string]string{}
	for k, vv := range res.Header {
		if len(vv) > 0 {
			hdr[k] = vv[0]
		}
	}
	_ = r.send(frame{"type": "proxyHttpResponse", "callId": callID, "status": res.StatusCode, "headers": hdr})
	buf := make([]byte, 32*1024)
	for {
		n, err := res.Body.Read(buf)
		if n > 0 {
			_ = r.send(frame{"type": "proxyHttpChunk", "callId": callID, "dataBase64": b64Encode(buf[:n])})
		}
		if err != nil {
			break
		}
	}
	_ = r.send(frame{"type": "proxyHttpEnd", "callId": callID})
}

func bytesReader(b []byte) *bytes.Reader {
	if len(b) == 0 {
		return bytes.NewReader(nil)
	}
	return bytes.NewReader(b)
}

func itoa(n int) string {
	return fmt.Sprint(n)
}

// --- code-server WebSocket tunnel -------------------------------------------

var (
	wsTunnels   = map[string]*websocket.Conn{}
	wsTunnelsMu sync.Mutex
)

// doProxyWsOpen: dial a WebSocket on a localhost port (code-server workbench)
// and bridge frames: upstream -> proxyWsData frames, proxyWsWrite -> upstream.
func (r *runner) doProxyWsOpen(f frame) {
	callID := f.str("callId")
	port := f.num("port")
	path := f.str("path")
	if port <= 0 || path == "" {
		_ = r.send(frame{"type": "proxyWsOpenResult", "callId": callID, "error": "bad port/path"})
		return
	}
	// Do NOT offer a subprotocol: code-server answers the Management socket
	// with no Sec-WebSocket-Protocol, and gorilla (unlike browsers) hard-fails
	// the handshake when an offered subprotocol isn't echoed — the whole
	// editor relay then died 1006. code-server ignores the header regardless.
	dialer := websocket.Dialer{Subprotocols: []string{}}
	hdr := http.Header{}
	if headers, ok := f["headers"].(map[string]any); ok {
		for k, v := range headers {
			if strings.EqualFold(k, "sec-websocket-protocol") {
				continue
			}
			hdr.Set(k, fmt.Sprint(v))
		}
	}
	conn, _, err := dialer.Dial(fmt.Sprintf("ws://127.0.0.1:%d%s", port, path), hdr)
	if err != nil {
		_ = r.send(frame{"type": "proxyWsOpenResult", "callId": callID, "error": err.Error()})
		return
	}
	wsTunnelsMu.Lock()
	wsTunnels[callID] = conn
	wsTunnelsMu.Unlock()
	_ = r.send(frame{"type": "proxyWsOpenResult", "callId": callID, "ok": true})

	go func() {
		for {
			mt, data, err := conn.ReadMessage()
			if err != nil {
				break
			}
			if mt == websocket.BinaryMessage {
				_ = r.send(frame{"type": "proxyWsData", "callId": callID, "dataBase64": b64Encode(data)})
			} else {
				_ = r.send(frame{"type": "proxyWsData", "callId": callID, "dataBase64": b64Encode(data)})
			}
		}
		wsTunnelsMu.Lock()
		delete(wsTunnels, callID)
		wsTunnelsMu.Unlock()
		_ = r.send(frame{"type": "proxyWsClose", "callId": callID})
	}()
}

func (r *runner) doProxyWsWrite(f frame) {
	callID := f.str("callId")
	wsTunnelsMu.Lock()
	conn := wsTunnels[callID]
	wsTunnelsMu.Unlock()
	if conn == nil {
		return
	}
	b, err := b64Decode(f.str("dataBase64"))
	if err != nil || len(b) == 0 {
		return
	}
	_ = conn.WriteMessage(websocket.BinaryMessage, b)
}

func (r *runner) doProxyWsClose(f frame) {
	callID := f.str("callId")
	wsTunnelsMu.Lock()
	conn := wsTunnels[callID]
	delete(wsTunnels, callID)
	wsTunnelsMu.Unlock()
	if conn != nil {
		_ = conn.Close()
	}
}
