package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type callState struct {
	id   string
	cmd  *exec.Cmd
	done bool
}

// jobHandle: a running job's process + its still-open stdin (jobInput feed).
type jobHandle struct {
	process     *os.Process
	stdin       io.WriteCloser
	stdinClosed bool
}

// Set once main() wires the runner; archive flows (microvm.go) need to send
// frames outside a handler's closure.
var globalRunner *runner

type runner struct {
	gateway  string
	key      string
	name     string
	microvm  bool
	stateDir string
	// Enrollment (first boot with --enroll): set until helloAck returns the
	// minted runner key, which is persisted to keyPath and used from then on.
	enrollToken string
	keyPath     string

	conn  *websocket.Conn
	write sync.Mutex

	jobs   map[string]*jobHandle
	jobsMu sync.Mutex
	calls  map[string]*callState
	callsMu sync.Mutex

	vms   map[string]*microvm
	vmsMu sync.Mutex

	nextSeq map[string]int // jobId -> seq
	seqMu   sync.Mutex

	// callId -> channel receiving every frame carrying that callId (multi-
	// frame flows like vmArchiveGet).
	resultWaiters map[string]chan map[string]any
	waitersMu     sync.Mutex

	cidCounter int
	kernelPath string
	rootfsPath string

	// set after helloAck: workspace this runner serves (archive uploads).
	workspaceID string
}

// connect dials the gateway's WS passthrough and serves frames until the
// socket drops, then returns (main retries).
func (r *runner) connect() error {
	u, err := url.Parse(r.gateway)
	if err != nil {
		return err
	}
	scheme := "ws"
	if u.Scheme == "https" {
		scheme = "wss"
	}
	// Enrollment (first ever connect): present the shared token; dispatch
	// mints a per-runner key and returns it in helloAck — persisted below.
	query := "key=" + url.QueryEscape(r.key)
	if r.enrollToken != "" {
		query = "enroll=" + url.QueryEscape(r.enrollToken)
	}
	wsURL := fmt.Sprintf("%s://%s/apps/dispatch/runner-ws?%s", scheme, u.Host, query)

	dialer := &websocket.Dialer{
		HandshakeTimeout: 15 * time.Second,
		TLSClientConfig:  &tls.Config{InsecureSkipVerify: strings.HasPrefix(r.gateway, "https://localhost")},
	}
	conn, _, err := dialer.Dial(wsURL, http.Header{"Origin": {r.gateway}})
	if err != nil {
		return err
	}
	r.conn = conn
	log.Printf("connected to %s", wsURL)

	kind := "host"
	if r.microvm {
		kind = "microvm-host"
	}
	if err := r.send(frame{
		"type": "hello",
		"name": r.name,
		"kind": kind,
		"meta": map[string]any{
			"os":       runtimeOS(),
			"arch":     runtimeArch(),
			"hostname": r.name,
			"version":  "0.1.0",
			"pid":      os.Getpid(),
		},
	}); err != nil {
		return err
	}

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		var f frame
		if err := json.Unmarshal(raw, &f); err != nil {
			continue
		}
		if f.str("type") == "helloAck" {
			r.workspaceID = f.str("workspaceId")
			if minted := f.str("runnerKey"); minted != "" {
				r.key = minted
				r.enrollToken = ""
				if r.keyPath != "" {
					if err := os.MkdirAll(filepath.Dir(r.keyPath), 0o755); err == nil {
					}
					if err := os.WriteFile(r.keyPath, []byte(minted+"\n"), 0o600); err != nil {
						log.Printf("persisting runner key to %s: %v (re-enroll will mint another)", r.keyPath, err)
					} else {
						log.Printf("runner key persisted to %s — future connects use it directly", r.keyPath)
					}
				}
			}
			log.Printf("registered as %q (workspace %s)", f.str("name"), r.workspaceID)
			continue
		}
		if t := f.str("type"); t == "result" || t == "vmArchiveData" {
			r.dispatchResult(f)
			continue
		}
		go r.handle(f)
	}
}

func (r *runner) send(f frame) error {
	r.write.Lock()
	defer r.write.Unlock()
	return r.conn.WriteJSON(f)
}

// expectResult registers a channel receiving all future frames for callID.
func (r *runner) expectResult(callID string, ch chan map[string]any) {
	r.waitersMu.Lock()
	r.resultWaiters[callID] = ch
	r.waitersMu.Unlock()
}

// dispatchResult fans a frame out to any waiter registered for its callId.
func (r *runner) dispatchResult(f frame) {
	callID, _ := f["callId"].(string)
	if callID == "" {
		return
	}
	r.waitersMu.Lock()
	ch := r.resultWaiters[callID]
	r.waitersMu.Unlock()
	if ch != nil {
		select {
		case ch <- f:
		default:
		}
	}
}

func runtimeOS() string   { return "linux" }
func runtimeArch() string { return "amd64" }

// handle dispatches one incoming frame.
func (r *runner) handle(f frame) {
	switch f.str("type") {
	case "ping":
		_ = r.send(frame{"type": "pong"})

	case "exec":
		r.doExec(f)
	case "call":
		r.doCall(f)
	case "jobCreate":
		r.doJobCreate(f)
	case "jobSignal":
		r.doJobSignal(f)
	case "jobInput":
		r.doJobInput(f)
	case "vmBoot":
		r.doVmBoot(f)
	case "vmExec":
		r.doVmExec(f)
	case "vmShutdown":
		r.doVmShutdown(f)
	case "vmStream":
		r.doVmStream(f)
	case "vmWrite":
		r.doVmWrite(f)
	case "vmClose":
		r.doVmClose(f)

	case "termOpen":
		r.doTermOpen(f)
	case "termWrite":
		r.doTermWrite(f)
	case "termResize":
		r.doTermResize(f)
	case "termClose":
		r.doTermClose(f)

	case "proxyHttp":
		r.doProxyHttp(f)
	case "proxyWsOpen":
		r.doProxyWsOpen(f)
	case "proxyWsWrite":
		r.doProxyWsWrite(f)
	case "proxyWsClose":
		r.doProxyWsClose(f)
	}
}

// --- exec: run to completion, buffer, reply ----------------------------------

func (r *runner) doExec(f frame) {
	cmd := r.buildCmd(f, nil)
	outBuf := &lockedBuffer{}
	errBuf := &lockedBuffer{}
	cmd.Stdout = outBuf
	cmd.Stderr = errBuf
	err := cmd.Run()
	exit := exitCode(err)

	res := frame{
		"type":     "result",
		"callId":   f.str("callId"),
		"exitCode": exit,
		"stdout":   outBuf.String(),
		"stderr":   errBuf.String(),
	}
	if err != nil && exit == -1 {
		res["error"] = err.Error()
	}
	_ = r.send(res)
}

// --- call: stream chunks back as output frames --------------------------------

func (r *runner) doCall(f frame) {
	callID := f.str("callId")
	st := &callState{id: callID}
	r.callsMu.Lock()
	r.calls[callID] = st
	r.callsMu.Unlock()

	cmd := r.buildCmd(f, nil)
	stdout, err := cmd.StdoutPipe()
	if err == nil {
		go r.pump(callID, "stdout", stdout)
	}
	stderr, err2 := cmd.StderrPipe()
	if err2 == nil {
		go r.pump(callID, "stderr", stderr)
	}
	st.cmd = cmd
	runErr := cmd.Start()
	if runErr != nil {
		_ = r.send(frame{"type": "output", "callId": callID, "stream": "stderr", "chunk": runErr.Error()})
		_ = r.send(frame{"type": "output", "callId": callID, "stream": "stdout", "chunk": "", "done": true, "exitCode": -1})
		return
	}
	go func() {
		exit := exitCode(cmd.Wait())
		r.callsMu.Lock()
		st.done = true
		delete(r.calls, callID)
		r.callsMu.Unlock()
		_ = r.send(frame{"type": "output", "callId": callID, "stream": "stdout", "chunk": "", "done": true, "exitCode": exit})
	}()
}

func (r *runner) pump(callID, stream string, rd interface{ Read([]byte) (int, error) }) {
	buf := make([]byte, 4096)
	for {
		n, err := rd.Read(buf)
		if n > 0 {
			_ = r.send(frame{
				"type":   "output",
				"callId": callID,
				"stream": stream,
				"chunk":  string(buf[:n]),
			})
		}
		if err != nil {
			return
		}
	}
}

// --- jobs --------------------------------------------------------------------

func (r *runner) doJobCreate(f frame) {
	jobID := f.str("jobId")
	cmd := r.buildCmd(f, func(c *exec.Cmd) {
		// Jobs log line-by-line; a pty would add echo noise we don't want.
	})
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()
	// stdin stays open so callers can feed the job later (jobInput frames).
	stdin, _ := cmd.StdinPipe()

	if err := cmd.Start(); err != nil {
		_ = r.send(frame{"type": "jobStatus", "jobId": jobID, "status": "failed", "exitCode": -1})
		return
	}
	r.jobsMu.Lock()
	r.jobs[jobID] = &jobHandle{process: cmd.Process, stdin: stdin}
	r.jobsMu.Unlock()

	go func() {
		r.pumpJob(jobID, "stdout", stdout)
	}()
	go func() {
		r.pumpJob(jobID, "stderr", stderr)
	}()
	go func() {
		exit := exitCode(cmd.Wait())
		r.jobsMu.Lock()
		if h := r.jobs[jobID]; h != nil {
			h.stdinClosed = true
		}
		delete(r.jobs, jobID)
		r.jobsMu.Unlock()
		_ = r.send(frame{"type": "jobStatus", "jobId": jobID, "status": statusFor(exit), "exitCode": exit})
	}()
}

// jobInput: feed bytes to a running job's stdin (data) or close it (eof:1).
func (r *runner) doJobInput(f frame) {
	jobID := f.str("jobId")
	r.jobsMu.Lock()
	h := r.jobs[jobID]
	r.jobsMu.Unlock()
	if h == nil {
		_ = r.send(frame{"type": "result", "callId": f.str("callId"), "error": "job not running"})
		return
	}
	if eof, _ := f["eof"].(bool); eof {
		if !h.stdinClosed {
			h.stdinClosed = true
			h.stdin.Close()
		}
		_ = r.send(frame{"type": "result", "callId": f.str("callId"), "ok": true})
		return
	}
	data, _ := f["data"].(string)
	if data == "" {
		_ = r.send(frame{"type": "result", "callId": f.str("callId"), "error": "data required"})
		return
	}
	if h.stdinClosed {
		_ = r.send(frame{"type": "result", "callId": f.str("callId"), "error": "stdin closed"})
		return
	}
	if _, err := h.stdin.Write([]byte(data)); err != nil {
		_ = r.send(frame{"type": "result", "callId": f.str("callId"), "error": err.Error()})
		return
	}
	_ = r.send(frame{"type": "result", "callId": f.str("callId"), "ok": true})
}

func (r *runner) pumpJob(jobID, stream string, rd interface{ Read([]byte) (int, error) }) {
	r.seqMu.Lock()
	r.nextSeq[jobID] = 0
	r.seqMu.Unlock()
	buf := make([]byte, 8192)
	var carry []byte
	for {
		n, err := rd.Read(buf)
		if n > 0 {
			carry = append(carry, buf[:n]...)
			for {
				idx := indexByte(carry, '\n')
				if idx < 0 {
					break
				}
				line := string(carry[:idx])
				carry = carry[idx+1:]
				r.seqMu.Lock()
				r.nextSeq[jobID]++
				seq := r.nextSeq[jobID]
				r.seqMu.Unlock()
				_ = r.send(frame{"type": "jobLog", "jobId": jobID, "seq": seq, "stream": stream, "line": line})
			}
		}
		if err != nil {
			if len(carry) > 0 {
				r.seqMu.Lock()
				r.nextSeq[jobID]++
				seq := r.nextSeq[jobID]
				r.seqMu.Unlock()
				_ = r.send(frame{"type": "jobLog", "jobId": jobID, "seq": seq, "stream": stream, "line": string(carry)})
			}
			return
		}
	}
}

func indexByte(b []byte, c byte) int {
	for i, x := range b {
		if x == c {
			return i
		}
	}
	return -1
}

func (r *runner) doJobSignal(f frame) {
	jobID := f.str("jobId")
	r.jobsMu.Lock()
	h := r.jobs[jobID]
	r.jobsMu.Unlock()
	if h == nil {
		return
	}
	_ = h.process.Signal(os.Interrupt)
	time.AfterFunc(5*time.Second, func() {
		_ = h.process.Signal(os.Kill)
	})
}

// --- shared helpers ----------------------------------------------------------

func (r *runner) buildCmd(f frame, tune func(*exec.Cmd)) *exec.Cmd {
	cmd := exec.Command("sh", "-c", f.str("command"))
	if cwd := f.str("cwd"); cwd != "" {
		cmd.Dir = cwd
	}
	if env, ok := f["env"].(map[string]any); ok {
		for k, v := range env {
			cmd.Env = append(cmd.Env, k+"="+fmt.Sprint(v))
		}
	}
	cmd.Env = append(os.Environ(), cmd.Env...)
	if tune != nil {
		tune(cmd)
	}
	return cmd
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	if ee, ok := err.(*exec.ExitError); ok {
		return ee.ExitCode()
	}
	return -1
}

func statusFor(exit int) string {
	if exit == 0 {
		return "completed"
	}
	return "failed"
}

func (r *runner) shutdownAll() {
	r.jobsMu.Lock()
	for _, h := range r.jobs {
		_ = h.process.Signal(os.Kill)
	}
	r.jobsMu.Unlock()
	r.vmsMu.Lock()
	for id, vm := range r.vms {
		_ = vm.shutdown(true)
		_ = id
	}
	r.vmsMu.Unlock()
}

// lockedBuffer: strings.Builder with a mutex (concurrent stdout/stderr writes).
type lockedBuffer struct {
	mu  sync.Mutex
	buf strings.Builder
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
