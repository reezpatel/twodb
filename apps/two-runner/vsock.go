package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// vsock plumbing through firecracker's UDS. Firecracker exposes the guest's
// vsock as a unix domain socket where connecting to the abstract path
// "<port>" (i.e. AF_UNIX path "52") reaches guest CID:port. We speak our
// length-prefixed JSON frames over that socket.

type vsockConn struct {
	conn net.Conn
}

func dialVsock(udsPath, port string) (*vsockConn, error) {
	// Firecracker's vsock UDS protocol (host-initiated): connect to the
	// unix socket, then send "CONNECT <port>\n" and read "OK <hostport>\n"
	// before any payload (see firecracker docs/vsock.md).
	conn, err := net.Dial("unix", udsPath)
	if err != nil {
		return nil, err
	}
	if _, err := conn.Write([]byte("CONNECT " + port + "\n")); err != nil {
		conn.Close()
		return nil, err
	}
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	buf := make([]byte, 64)
	n, err := conn.Read(buf)
	conn.SetReadDeadline(time.Time{})
	if err != nil {
		conn.Close()
		return nil, err
	}
	reply := string(buf[:n])
	if !strings.HasPrefix(reply, "OK ") {
		conn.Close()
		return nil, fmt.Errorf("vsock connect refused: %s", strings.TrimSpace(reply))
	}
	return &vsockConn{conn: conn}, nil
}

func (c *vsockConn) Write(p []byte) (int, error) { return c.conn.Write(p) }
func (c *vsockConn) Read(p []byte) (int, error)  { return c.conn.Read(p) }
func (c *vsockConn) Close() error                { return c.conn.Close() }
func (c *vsockConn) SetDeadline(t time.Time) error { return c.conn.SetDeadline(t) }

func writeFrame(w io.Writer, v map[string]any) error {
	body, err := json.Marshal(v)
	if err != nil {
		return err
	}
	var lenBuf [4]byte
	binary.BigEndian.PutUint32(lenBuf[:], uint32(len(body)))
	if _, err := w.Write(lenBuf[:]); err != nil {
		return err
	}
	_, err = w.Write(body)
	return err
}

func readFrame(r io.Reader) (map[string]any, error) {
	var lenBuf [4]byte
	if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
		return nil, err
	}
	n := binary.BigEndian.Uint32(lenBuf[:])
	if n == 0 || n > 64<<20 {
		return nil, fmt.Errorf("bad frame length %d", n)
	}
	body := make([]byte, n)
	if _, err := io.ReadFull(r, body); err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func b64Encode(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

func b64Decode(s string) ([]byte, error) { return base64.StdEncoding.DecodeString(s) }

func jsonMarshal(v any) ([]byte, error) { return json.Marshal(v) }

// --- terminal / vscode relay over vsock -----------------------------------------

// vmStream mode handling: the guest agent starts a pty (terminal) or
// code-server (vscode) and bridges raw bytes through this vsock conn.
// The runner relays between the WS (via dispatch hub) and this vsock conn.

func (r *runner) doVmStream(f frame) {
	callID := f.str("callId")
	id := f.str("identifier")
	mode := f.str("mode")

	r.vmsMu.Lock()
	vm := r.vms[id]
	r.vmsMu.Unlock()
	if vm == nil || vm.dead {
		_ = r.send(frame{"type": "result", "callId": callID, "error": "microvm not running"})
		return
	}

	// Ask the agent to open the stream; it stays connected and relays.
	conn, err := vm.vsockDial()
	if err != nil {
		_ = r.send(frame{"type": "result", "callId": callID, "error": err.Error()})
		return
	}
	if err := writeFrame(conn, map[string]any{"op": "stream", "mode": mode}); err != nil {
		conn.Close()
		_ = r.send(frame{"type": "result", "callId": callID, "error": err.Error()})
		return
	}
	rep, err := readFrame(conn)
	if err != nil || rep["ok"] != true {
		msg := "stream refused"
		if err == nil {
			if e, _ := rep["error"].(string); e != "" {
				msg = e
			}
		}
		conn.Close()
		_ = r.send(frame{"type": "result", "callId": callID, "error": msg})
		return
	}
	_ = r.send(frame{"type": "result", "callId": callID, "ok": true})

	vm.mu.Lock()
	ch := make(chan []byte, 64)
	vm.relay[callID] = ch
	vm.mu.Unlock()

	// guest -> dispatch (vmData frames)
	go func() {
		defer func() {
			vm.mu.Lock()
			delete(vm.relay, callID)
			vm.mu.Unlock()
			conn.Close()
			_ = r.send(frame{"type": "vmClosed", "callId": callID})
		}()
		for {
			f, err := readFrame(conn)
			if err != nil {
				return
			}
			if data, _ := f["data"].(string); data != "" {
				_ = r.send(frame{"type": "vmData", "callId": callID, "data": data})
			}
		}
	}()

	// dispatch -> guest (bytes pulled from the relay channel)
	go func() {
		for b := range ch {
			if err := writeFrame(conn, map[string]any{"data": b64Encode(b)}); err != nil {
				return
			}
		}
	}()
}

func (r *runner) doVmWrite(f frame) {
	callID := f.str("callId")
	id := f.str("identifier")
	r.vmsMu.Lock()
	vm := r.vms[id]
	r.vmsMu.Unlock()
	if vm == nil {
		return
	}
	vm.mu.Lock()
	ch := vm.relay[callID]
	vm.lastTouch = time.Now()
	vm.mu.Unlock()
	if ch == nil {
		return
	}
	data, _ := f["data"].(string)
	raw, err := b64Decode(data)
	if err != nil {
		// callers may send plain utf-8 (terminal typing); accept it raw
		raw = []byte(data)
	}
	select {
	case ch <- raw:
	default:
		// slow consumer — drop; terminal apps tolerate it
	}
}

func (r *runner) doVmClose(f frame) {
	callID := f.str("callId")
	id := f.str("identifier")
	r.vmsMu.Lock()
	vm := r.vms[id]
	r.vmsMu.Unlock()
	if vm == nil {
		return
	}
	vm.mu.Lock()
	if ch, ok := vm.relay[callID]; ok {
		close(ch)
		delete(vm.relay, callID)
	}
	vm.mu.Unlock()
}

// --- archive helpers -------------------------------------------------------------

// unzipTo extracts a zip archive into dst (used on resume paths when the
// runner restores locally before the guest agent is up).
func unzipTo(zipBytes []byte, dst string) error {
	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return err
	}
	for _, zf := range zr.File {
		name := filepath.Clean(zf.Name)
		if strings.HasPrefix(name, "..") || filepath.IsAbs(name) {
			return errors.New("zip escape attempt: " + name)
		}
		target := filepath.Join(dst, name)
		if zf.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := zf.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(target)
		if err != nil {
			rc.Close()
			return err
		}
		if _, err := io.Copy(out, rc); err != nil {
			rc.Close()
			out.Close()
			return err
		}
		rc.Close()
		out.Close()
	}
	return nil
}
