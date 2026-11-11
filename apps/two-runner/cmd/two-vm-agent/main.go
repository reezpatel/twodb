// two-vm-agent — runs INSIDE the microvm as PID-1 companion.
//
// Listens on AF_VSOCK port 52 (host reaches it through firecracker's vsock
// UDS). Speaks length-prefixed JSON frames (same wire format as the runner
// side). Ops:
//
//   ping         liveness probe
//   exec         run a command, buffer output, reply {exitCode,stdout,stderr}
//   zipApp       zip /app in-memory, ready for getAppZip
//   getAppZip    stream the zip back in b64 frames
//   restoreApp   receive b64 zip chunks, unzip into /app
//   stream       mode=terminal: start a pty (sh), bridge raw bytes
//                mode=vscode: start code-server, bridge its stdio
package main

import (
	"bytes"
	"compress/gzip"
	"archive/zip"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

const vsockPort = 52

func main() {
	if err := os.MkdirAll("/app", 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "agent: /app: %v\n", err)
	}
	ln, err := listenVsock(vsockPort)
	if err != nil {
		fmt.Fprintf(os.Stderr, "agent: listen vsock: %v\n", err)
		// guest agent failed to get vsock — stay alive so the VM isn't
		// respawned in a loop; exec will just fail.
		select {}
	}
	fmt.Fprintf(os.Stderr, "agent: listening on vsock :%d\n", vsockPort)
	for {
		conn, err := ln.AcceptConn()
		if err != nil {
			fmt.Fprintf(os.Stderr, "agent: accept err: %v\n", err)
			continue
		}
		fmt.Fprintf(os.Stderr, "agent: accepted connection\n")
		go serve(conn)
	}
}

func serve(conn net.Conn) {
	defer conn.Close()
	for {
		req, err := readFrame(conn)
		if err != nil {
			fmt.Fprintf(os.Stderr, "agent: readFrame err: %v\n", err)
			return
		}
		fmt.Fprintf(os.Stderr, "agent: frame op=%v\n", req["op"])
		op, _ := req["op"].(string)
		switch op {
		case "ping":
			_ = writeFrame(conn, map[string]any{"ok": true})
		case "exec":
			doExec(conn, req)
		case "zipApp":
			doZipApp(conn)
		case "getAppZip":
			doGetAppZip(conn)
		case "restoreApp":
			doRestoreApp(conn, req)
		case "stream":
			doStream(conn, req)
		default:
			_ = writeFrame(conn, map[string]any{"error": "unknown op"})
		}
	}
}

// --- vsock listen ---------------------------------------------------------------

// sockaddrVm: AF_VSOCK address — Go's syscall package doesn't ship
// SockaddrVM upstream, so we define the ABI struct + Bind ourselves.
// struct sockaddr_vm { sa_family(16), svm_reserved1(16), svm_port(32),
// svm_cid(32), svm_zero[4] } — the full 16 bytes, or the kernel rejects
// the bind with EINVAL.
type sockaddrVm struct {
	family   uint16
	reserved uint16
	port     uint32
	cid      uint32
	zero     uint32
}

type vsockListener struct {
	fd int
}

func listenVsock(port uint32) (*vsockListener, error) {
	fd, err := syscall.Socket(40 /* AF_VSOCK */, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, err
	}
	// VMADDR_CID_ANY = 0xFFFFFFFF — the local CID is assigned by the kernel
	// (the guest CID firecracker configured); CID 2 is host-only and fails
	// with EINVAL inside a guest.
	sa := &sockaddrVm{family: 40, port: port, cid: 0xFFFFFFFF}
	pp, sz, err := packSockaddrVm(sa)
	if err != nil {
		return nil, err
	}
	if err := bindRaw(fd, pp, sz); err != nil {
		return nil, err
	}
	if err := syscall.Listen(fd, 16); err != nil {
		return nil, err
	}
	return &vsockListener{fd: fd}, nil
}

func packSockaddrVm(sa *sockaddrVm) (unsafe.Pointer, uintptr, error) {
	return unsafe.Pointer(sa), unsafe.Sizeof(*sa), nil
}

func bindRaw(fd int, sa unsafe.Pointer, sz uintptr) error {
	_, _, errno := syscall.Syscall(syscall.SYS_BIND, uintptr(fd), uintptr(sa), sz)
	if errno != 0 {
		return errno
	}
	return nil
}

// os.NewFile doesn't produce a net.Conn; wrap it instead.
func toConn(fd int) (net.Conn, error) {
	f := os.NewFile(uintptr(fd), "vsock-conn")
	return &fileConn{f: f}, nil
}

type fileConn struct {
	f *os.File
}

func (c *fileConn) Read(p []byte) (int, error)  { return c.f.Read(p) }
func (c *fileConn) Write(p []byte) (int, error) { return c.f.Write(p) }
func (c *fileConn) Close() error                { return c.f.Close() }
func (c *fileConn) LocalAddr() net.Addr         { return nil }
func (c *fileConn) RemoteAddr() net.Addr        { return nil }
func (c *fileConn) SetDeadline(t time.Time) error    { return c.f.SetDeadline(t) }
func (c *fileConn) SetReadDeadline(t time.Time) error  { return c.f.SetReadDeadline(t) }
func (c *fileConn) SetWriteDeadline(t time.Time) error { return c.f.SetWriteDeadline(t) }

// Accept via raw accept4: Go's syscall.Accept parses the returned sockaddr
// and fails with EAFNOSUPPORT for AF_VSOCK (unknown family). We only need
// the new fd; the peer address is implicit (host CID via firecracker).
func (l *vsockListener) AcceptConn() (net.Conn, error) {
	nfd, _, errno := syscall.Syscall6(syscall.SYS_ACCEPT4, uintptr(l.fd), 0, 0, 0, 0, 0)
	if errno != 0 {
		return nil, errno
	}
	return toConn(int(nfd))
}

// --- ops ------------------------------------------------------------------------

func doExec(conn net.Conn, req map[string]any) {
	cmdline, _ := req["command"].(string)
	if cmdline == "" {
		_ = writeFrame(conn, map[string]any{"error": "command required"})
		return
	}
	timeoutMs, _ := req["timeoutMs"].(float64)
	cmd := exec.Command("sh", "-c", cmdline)
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	done := make(chan error, 1)
	if err := cmd.Start(); err != nil {
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	go func() { done <- cmd.Wait() }()

	var waitErr error
	if timeoutMs > 0 {
		select {
		case waitErr = <-done:
		case <-timeAfterMs(int(timeoutMs)):
			_ = cmd.Process.Kill()
			waitErr = <-done
			_ = writeFrame(conn, map[string]any{
				"error": fmt.Sprintf("timeout after %dms", int(timeoutMs)),
			})
			return
		}
	} else {
		waitErr = <-done
	}
	exit := 0
	if waitErr != nil {
		if ee, ok := waitErr.(*exec.ExitError); ok {
			exit = ee.ExitCode()
		} else {
			exit = -1
		}
	}
	_ = writeFrame(conn, map[string]any{
		"exitCode": exit,
		"stdout":   out.String(),
		"stderr":   errBuf.String(),
	})
}

func timeAfterMs(ms int) <-chan struct{} {
	ch := make(chan struct{})
	go func() {
		time.Sleep(time.Duration(ms) * time.Millisecond)
		close(ch)
	}()
	return ch
}

// --- /app zip + restore -------------------------------------------------------------

var zipMu sync.Mutex
var zipBuf bytes.Buffer

func doZipApp(conn net.Conn) {
	zipMu.Lock()
	defer zipMu.Unlock()
	zipBuf.Reset()
	zw := zip.NewWriter(&zipBuf)
	err := walkZip("/app", "", zw)
	if err != nil {
		zw.Close()
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	if err := zw.Close(); err != nil {
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	_ = writeFrame(conn, map[string]any{"ok": true, "size": zipBuf.Len()})
}

func walkZip(root, rel string, zw *zip.Writer) error {
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, e := range entries {
		name := rel + "/" + e.Name()
		full := root + "/" + e.Name()
		if e.IsDir() {
			if _, err := zw.Create(name + "/"); err != nil {
				return err
			}
			if err := walkZip(full, name, zw); err != nil {
				return err
			}
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		hdr, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		hdr.Name = name
		w, err := zw.CreateHeader(hdr)
		if err != nil {
			return err
		}
		f, err := os.Open(full)
		if err != nil {
			continue
		}
		_, _ = io.Copy(w, f)
		f.Close()
	}
	return nil
}

func doGetAppZip(conn net.Conn) {
	zipMu.Lock()
	defer zipMu.Unlock()
	if zipBuf.Len() == 0 {
		_ = writeFrame(conn, map[string]any{"error": "no zipped app (zipApp first)"})
		return
	}
	data := zipBuf.Bytes()
	const chunk = 48 * 1024
	for off := 0; off < len(data); off += chunk {
		end := off + chunk
		if end > len(data) {
			end = len(data)
		}
		if err := writeFrame(conn, map[string]any{
			"ok":   true,
			"data": base64.StdEncoding.EncodeToString(data[off:end]),
		}); err != nil {
			return
		}
	}
	_ = writeFrame(conn, map[string]any{"ok": true, "done": true})
}

func doRestoreApp(conn net.Conn, req map[string]any) {
	size, _ := req["size"].(float64)
	if size <= 0 {
		_ = writeFrame(conn, map[string]any{"error": "size required"})
		return
	}
	var buf bytes.Buffer
	for int64(buf.Len()) < int64(size) {
		f, err := readFrame(conn)
		if err != nil {
			return
		}
		b64, _ := f["data"].(string)
		if b64 == "" {
			_ = writeFrame(conn, map[string]any{"error": "expected data chunk"})
			return
		}
		chunk, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			_ = writeFrame(conn, map[string]any{"error": "bad chunk"})
			return
		}
		buf.Write(chunk)
	}
	if err := unzipTo(buf.Bytes(), "/app"); err != nil {
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	_ = writeFrame(conn, map[string]any{"ok": true, "restored": buf.Len()})
}

func unzipTo(zipBytes []byte, dst string) error {
	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return err
	}
	for _, zf := range zr.File {
		name := zf.Name
		if strings.HasPrefix(name, "..") || strings.Contains(name, "..") {
			continue
		}
		target := dst + "/" + name
		if zf.FileInfo().IsDir() {
			_ = os.MkdirAll(target, 0o755)
			continue
		}
		_ = os.MkdirAll(target[:strings.LastIndex(target, "/")], 0o755)
		rc, err := zf.Open()
		if err != nil {
			continue
		}
		out, err := os.Create(target)
		if err != nil {
			rc.Close()
			continue
		}
		_, _ = io.Copy(out, rc)
		rc.Close()
		out.Close()
	}
	return nil
}

// --- terminal / vscode relay ---------------------------------------------------------

func doStream(conn net.Conn, req map[string]any) {
	mode, _ := req["mode"].(string)
	switch mode {
	case "terminal":
		doTerminal(conn)
	case "vscode":
		doVscode(conn)
	default:
		_ = writeFrame(conn, map[string]any{"error": "unknown mode"})
	}
}

// doTerminal: pty-backed shell. Raw input frames {data:b64} -> pty master;
// pty output -> {data:b64} frames back.
func doTerminal(conn net.Conn) {
	ptmx, err := openPty()
	if err != nil {
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	cmd := exec.Command("sh")
	cmd.Stdin = ptmx
	cmd.Stdout = ptmx
	cmd.Stderr = ptmx
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	if err := cmd.Start(); err != nil {
		ptmx.Close()
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	_ = writeFrame(conn, map[string]any{"ok": true})

	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				if writeFrame(conn, map[string]any{"data": base64.StdEncoding.EncodeToString(buf[:n])}) != nil {
					break
				}
			}
			if err != nil {
				break
			}
		}
		_ = writeFrame(conn, map[string]any{"done": true})
		conn.Close()
	}()
	go func() {
		defer ptmx.Close()
		for {
			f, err := readFrame(conn)
			if err != nil {
				_ = cmd.Process.Kill()
				return
			}
			if b64, _ := f["data"].(string); b64 != "" {
				raw, err := base64.StdEncoding.DecodeString(b64)
				if err != nil {
					continue
				}
				if _, err := ptmx.Write(raw); err != nil {
					return
				}
			}
		}
	}()
	_ = cmd.Wait()
}

// doVscode: code-server fork streamed over the relay. v1 launches
// code-server headless on a random port inside the VM and pipes its stdio;
// callers get a URL frame to open (the runner relays bytes either way).
func doVscode(conn net.Conn) {
	bin := findVscode()
	if bin == "" {
		_ = writeFrame(conn, map[string]any{"error": "no vscode fork installed in the microvm (install code-server under /usr/local/bin)"})
		return
	}
	cmd := exec.Command(bin, "--host", "127.0.0.1", "--port", "0", "--disable-telemetry")
	r, w, err := os.Pipe()
	if err != nil {
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	cmd.Stdout = w
	cmd.Stderr = w
	if err := cmd.Start(); err != nil {
		_ = writeFrame(conn, map[string]any{"error": err.Error()})
		return
	}
	_ = writeFrame(conn, map[string]any{"ok": true})
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := r.Read(buf)
			if n > 0 {
				if writeFrame(conn, map[string]any{"data": base64.StdEncoding.EncodeToString(buf[:n])}) != nil {
					break
				}
			}
			if err != nil {
				break
			}
		}
		_ = writeFrame(conn, map[string]any{"done": true})
		conn.Close()
	}()
	go func() {
		for {
			f, err := readFrame(conn)
			if err != nil {
				_ = cmd.Process.Kill()
				return
			}
			if b64, _ := f["data"].(string); b64 != "" {
				raw, _ := base64.StdEncoding.DecodeString(b64)
				_, _ = cmd.Stdin.(io.Writer).Write(raw)
			}
		}
	}()
	_ = cmd.Wait()
}

func findVscode() string {
	for _, p := range []string{"/usr/local/bin/code-server", "/usr/bin/code-server", "/app/vscode/bin/code-server"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if out, err := exec.Command("sh", "-c", "command -v code-server || command -v code").Output(); err == nil {
		return strings.TrimSpace(string(out))
	}
	return ""
}

// --- pty ------------------------------------------------------------------------

func openPty() (*os.File, error) {
	ptmx, _, err := ptyOpen()
	return ptmx, err
}

// minimal pty open via posix_openpt/grantpt/unlockpt
func ptyOpen() (*os.File, *os.File, error) {
	fd, err := syscall.Open("/dev/ptmx", syscall.O_RDWR|syscall.O_NOCTTY, 0)
	if err != nil {
		return nil, nil, err
	}
	f := os.NewFile(uintptr(fd), "ptmx")
	// grantpt/unlockpt via TIOCGPTN/pt locks
	var n uint32
	if err := ioctl(fd, syscall.TIOCGPTN, unsafe.Pointer(&n)); err != nil {
		f.Close()
		return nil, nil, err
	}
	var unlock int32 = 0
	if err := ioctl(fd, syscall.TIOCSPTLCK, unsafe.Pointer(&unlock)); err != nil {
		f.Close()
		return nil, nil, err
	}
	return f, nil, nil
}

func ioctl(fd int, req uint, arg unsafe.Pointer) error {
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd), uintptr(req), uintptr(arg))
	if errno != 0 {
		return errno
	}
	return nil
}

// --- frames -----------------------------------------------------------------------

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

var _ = gzip.NewWriter
