package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

// microvm is one Firecracker VM on this host: disks under stateDir, a vsock
// CID, a firecracker process, and a guest agent (in the rootfs) listening on
// vsock port 52 ("VM"). Idle shutdown: after idleShutdownSec with no vmExec
// or attached streams, the runner asks the agent to zip /app, ships the zip
// to dispatch's archive endpoint (S3 stub), and powers the VM off. A later
// vmBoot with the same identifier restores /app from the archive first.
type microvm struct {
	id        string
	cid       int
	apiSocket string
	fcCmd     *exec.Cmd
	dir       string
	idleSec   int
	lastTouch time.Time
	vsockPort uint32
	mu        sync.Mutex
	dead      bool
	relay     map[string]chan []byte // callId -> guest pty/vscode stream
	gateway    string
	workspaceID string
	runnerKey   string
}

const guestAgentPort = 52

// agentFrame: tiny length-prefixed JSON protocol over vsock.
// 4-byte big-endian length + JSON body. Requests carry {op, ...}; replies
// carry {ok, ...} or {data} for stream chunks.

func (r *runner) initMicrovmHost() error {
	if _, err := os.Stat("/dev/kvm"); err != nil {
		return fmt.Errorf("/dev/kvm not accessible: %w", err)
	}
	if err := os.MkdirAll(r.stateDir, 0o755); err != nil {
		return err
	}
	fc := r.fcBin()
	if _, err := os.Stat(fc); err != nil {
		return fmt.Errorf("firecracker binary not found at %s (set TWO_RUNNER_FC_BIN)", fc)
	}
	if err := r.ensureGuestAssets(); err != nil {
		return err
	}
	r.nextSeq = map[string]int{}
	return nil
}

func (r *runner) fcBin() string {
	if v := os.Getenv("TWO_RUNNER_FC_BIN"); v != "" {
		return v
	}
	return filepath.Join(r.stateDir, "firecracker")
}

// ensureGuestAssets resolves kernel + rootfs. Env overrides first, then
// bundled copies under stateDir, then the twodb-dispatch download dir.
func (r *runner) ensureGuestAssets() error {
	for _, pair := range [][2]string{
		{"TWO_RUNNER_KERNEL", "kernel"},
		{"TWO_RUNNER_ROOTFS", "rootfs.ext4"},
	} {
		env, local := pair[0], pair[1]
		p := filepath.Join(r.stateDir, local)
		if v := os.Getenv(env); v != "" {
			p = v
		} else if _, err := os.Stat(p); err == nil {
			continue
		} else {
			fallback := filepath.Join(os.Getenv("HOME"), ".local/share/twodb-dispatch/fc", map[string]string{
				"kernel":     "vmlinux",
				"rootfs.ext4": "ubuntu-24.04.ext4",
			}[local])
			if _, err2 := os.Stat(fallback); err2 == nil {
				p = fallback
			} else {
				return fmt.Errorf("guest %s not found (set %s or place it at %s)", local, env, filepath.Join(r.stateDir, local))
			}
		}
		if strings.HasSuffix(local, ".ext4") || local == "rootfs.ext4" {
			r.rootfsPath = p
		} else {
			r.kernelPath = p
		}
	}
	return nil
}

// --- boot / resume -------------------------------------------------------------

func (r *runner) doVmBoot(f frame) {
	callID := f.str("callId")
	id := f.str("identifier")
	logf("vmBoot %s received", id)
	memMB := f.num("memMb")
	vcpu := f.num("vcpu")
	idle := f.num("idleShutdownSec")
	if memMB == 0 {
		memMB = 512
	}
	if vcpu == 0 {
		vcpu = 1
	}
	if idle == 0 {
		idle = 900
	}

	r.vmsMu.Lock()
	vm := r.vms[id]
	r.vmsMu.Unlock()

	// Resume decision: dispatch owns the lifecycle (did this identifier
	// exist before? is there an archive?) — it sends `resume: true` and the
	// runner restores /app; a fresh identifier boots empty.
	resume, _ := f["resume"].(bool)
	logf("vmBoot %s: existing=%v resume=%v", id, vm != nil, resume)
	if vm == nil || vm.dead {
		var err error
		vm, err = r.newVM(id, memMB, vcpu, idle, f.str("cid") != "")
		if err != nil {
			logf("vm %s: newVM failed: %v", id, err)
			_ = r.send(frame{"type": "result", "callId": callID, "error": err.Error()})
			return
		}
		r.vmsMu.Lock()
		r.vms[id] = vm
		r.vmsMu.Unlock()
	} else {
		vm.mu.Lock()
		vm.idleSec = idle
		vm.lastTouch = time.Now()
		vm.mu.Unlock()
	}

	// Wait for the guest agent BEFORE restoring: firecracker creates the
	// vsock UDS a beat after spawn, and the restore streams through it.
	logf("vm %s: waiting for agent (kernel=%s rootfs=%s fc=%s)", id, r.kernelPath, r.rootfsPath, r.fcBin())
	if err := vm.waitAgent(20 * time.Second); err != nil {
		logf("vm %s: agent not ready: %v", id, err)
		_ = r.send(frame{"type": "result", "callId": callID, "error": fmt.Sprintf("guest agent not ready: %v", err)})
		return
	}

	if resume {
		if err := vm.restoreApp(r.gateway, r.key); err != nil {
			logf("vm %s: restore /app skipped: %v", id, err)
		} else {
			logf("vm %s: /app restored from archive", id)
		}
	}

	_ = r.send(frame{"type": "result", "callId": callID, "cid": vm.cid, "resumed": resume})
	_ = r.send(frame{"type": "vmEvent", "identifier": id, "event": "started"})
	vm.startIdleWatch(r, idle)
}

func (r *runner) newVM(id string, memMB, vcpu, idleSec int, cidHint bool) (*microvm, error) {
	r.cidCounter++
	cid := 3 + r.cidCounter
	dir := filepath.Join(r.stateDir, "vms", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	vm := &microvm{
		id:        id,
		cid:       cid,
		apiSocket: filepath.Join(dir, "fc.sock"),
		dir:       dir,
		idleSec:   idleSec,
		lastTouch: time.Now(),
		relay:     map[string]chan []byte{},
		gateway:    r.gateway,
		workspaceID: r.workspaceID,
		runnerKey:   r.key,
	}

	// rootfs: fresh ext4 copy (or resume: restored archive happens after boot)
	disk := filepath.Join(dir, "rootfs.ext4")
	if err := copyFile(r.rootfsPath, disk); err != nil {
		return nil, err
	}

	cfg := map[string]any{
		"boot-source": map[string]any{
			"kernel_image_path": r.kernelPath,
			"boot_args": "console=ttyS0 reboot=k panic=1 pci=off " +
				"init=/sbin/init quiet loglevel=2 " +
				fmt.Sprintf("twodb.vm.id=%s", id),
		},
		"drives": []map[string]any{
			{
				"drive_id":      "rootfs",
				"path_on_host":  disk,
				"is_root_device": true,
				"is_read_only":  false,
			},
		},
		"machine-config": map[string]any{
			"vcpu_count": vcpu,
			"mem_size_mib": memMB,
			"smt":         true,
		},
		"vsock": map[string]any{
			"guest_cid": cid,
			"uds_path":  filepath.Join(dir, "vsock.sock"),
		},
	}
	cfgBytes, _ := jsonMarshal(cfg)
	cfgPath := filepath.Join(dir, "vmconfig.json")
	if err := os.WriteFile(cfgPath, cfgBytes, 0o644); err != nil {
		return nil, err
	}

	fc := exec.Command(r.fcBin(), "--api-sock", vm.apiSocket, "--config-file", cfgPath)
	fc.Stdout = os.Stderr
	fc.Stderr = os.Stderr
	if err := fc.Start(); err != nil {
		return nil, err
	}
	vm.fcCmd = fc
	return vm, nil
}

// waitAgent polls the guest agent over vsock until it answers a ping.
func (vm *microvm) waitAgent(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		_, err := vm.agentCall(map[string]any{"op": "ping"}, 3*time.Second)
		if err == nil {
			return nil
		}
		time.Sleep(300 * time.Millisecond)
	}
	return fmt.Errorf("timeout")
}

// agentCall: one vsock request/reply with the guest agent.
func (vm *microvm) agentCall(req map[string]any, timeout time.Duration) (map[string]any, error) {
	conn, err := vm.vsockDial()
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))
	if err := writeFrame(conn, req); err != nil {
		return nil, err
	}
	return readFrame(conn)
}

func (vm *microvm) vsockDial() (*vsockConn, error) {
	// Connect through firecracker's vsock UDS: path "52<CID>" -> port.
	addr := fmt.Sprintf("%s", vm.apiSocket)
	_ = addr
	return dialVsock(filepath.Join(vm.dir, "vsock.sock"), fmt.Sprintf("%d", guestAgentPort))
}

// --- idle watch / shutdown / archive -------------------------------------------

func (vm *microvm) startIdleWatch(r *runner, idleSec int) {
	go func() {
		t := time.NewTicker(time.Second)
		defer t.Stop()
		for range t.C {
			vm.mu.Lock()
			dead := vm.dead
			idle := time.Since(vm.lastTouch) > time.Duration(vm.idleSec)*time.Second
			attached := len(vm.relay) > 0
			vm.mu.Unlock()
			if dead {
				return
			}
			if idle && !attached {
				t.Stop()
				if err := vm.shutdown(true); err != nil {
					logf("vm %s idle shutdown: %v", vm.id, err)
				}
				_ = r.send(frame{"type": "vmEvent", "identifier": vm.id, "event": "stopped", "detail": "idle"})
				return
			}
		}
	}()
}

func (vm *microvm) shutdown(archive bool) error {
	vm.mu.Lock()
	if vm.dead {
		vm.mu.Unlock()
		return nil
	}
	// Ask the agent for a clean /app zip first (best-effort — a dead guest
	// just gets killed).
	if archive {
		_, err := vm.agentCall(map[string]any{"op": "zipApp"}, 30*time.Second)
		if err == nil {
			// Pull the zip out through vsock.
			if zerr := vm.fetchArchive(); zerr != nil {
				logf("vm %s: fetch archive: %v", vm.id, zerr)
			}
		} else {
			logf("vm %s: zipApp failed (hard shutdown): %v", vm.id, err)
		}
	}
	vm.dead = true
	vm.mu.Unlock()

	if vm.fcCmd != nil && vm.fcCmd.Process != nil {
		_ = vm.fcCmd.Process.Kill()
	}
	_ = syscall.Unlink(vm.apiSocket)
	_ = syscall.Unlink(filepath.Join(vm.dir, "vsock.sock"))
	return nil
}

// fetchArchive: agent streams the zip over vsock; runner POSTs it to
// dispatch's archive endpoint (the S3 stub).
func (vm *microvm) fetchArchive() error {
	_ = vm.runnerKey
	conn, err := vm.vsockDial()
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(2 * time.Minute))
	if err := writeFrame(conn, map[string]any{"op": "getAppZip"}); err != nil {
		return err
	}
	// Reply frames: {ok,data,b64} until {ok,done:true}.
	var buf bytes.Buffer
	for {
		rep, err := readFrame(conn)
		if err != nil {
			return err
		}
		if errStr, _ := rep["error"].(string); errStr != "" {
			return fmt.Errorf("%s", errStr)
		}
		if b64, _ := rep["data"].(string); b64 != "" {
			chunk, err := b64Decode(b64)
			if err != nil {
				return err
			}
			buf.Write(chunk)
		}
		if done, _ := rep["done"].(bool); done {
			break
		}
	}
	if buf.Len() == 0 {
		return fmt.Errorf("empty archive")
	}
	// Ship the zip over the authenticated runner WS (vmArchive frames) —
	// no separate HTTP auth surface for runners.
	hub := globalRunner
	if hub == nil {
		return fmt.Errorf("runner not initialized")
	}
	callID := fmt.Sprintf("arch-%d", time.Now().UnixNano())
	_ = hub.send(frame{"type": "vmArchive", "callId": callID, "identifier": vm.id, "begin": true})
	const chunkSize = 48 * 1024
	data := buf.Bytes()
	for off := 0; off < len(data); off += chunkSize {
		end := off + chunkSize
		if end > len(data) {
			end = len(data)
		}
		_ = hub.send(frame{
			"type":       "vmArchive",
			"callId":     callID,
			"identifier": vm.id,
			"data":       b64Encode(data[off:end]),
		})
	}
	_ = hub.send(frame{"type": "vmArchive", "callId": callID, "identifier": vm.id, "done": true})
	return nil
}

// restoreApp fetches the newest archive zip over the runner WS and ships
// it into the guest (agent unzips into /app).
func (vm *microvm) restoreApp(gateway, key string) error {
	hub := globalRunner
	if hub == nil {
		return fmt.Errorf("runner not initialized")
	}
	callID := fmt.Sprintf("archget-%d", time.Now().UnixNano())
	resCh := make(chan map[string]any, 1)
	hub.expectResult(callID, resCh)
	_ = hub.send(frame{"type": "vmArchiveGet", "callId": callID, "identifier": vm.id})
	var zipBuf []byte
	deadline := time.After(2 * time.Minute)
loop:
	for {
		select {
		case f := <-resCh:
			if e, _ := f["error"].(string); e != "" {
				return fmt.Errorf("%s", e)
			}
			if d, _ := f["data"].(string); d != "" {
				chunk, err := b64Decode(d)
				if err != nil {
					return err
				}
				zipBuf = append(zipBuf, chunk...)
			}
			if done, _ := f["done"].(bool); done {
				break loop
			}
		case <-deadline:
			return fmt.Errorf("archive download timeout")
		}
	}
	if len(zipBuf) == 0 {
		return fmt.Errorf("no archive")
	}
	_ = gateway
	_ = key
	return vm.agentSendZip(zipBuf)
}

// agentSendZip streams the zip into the guest in b64 frames; agent unzips
// to /app.
func (vm *microvm) agentSendZip(zipBytes []byte) error {
	conn, err := vm.vsockDial()
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(5 * time.Minute))
	if err := writeFrame(conn, map[string]any{"op": "restoreApp", "size": len(zipBytes)}); err != nil {
		return err
	}
	const chunkSize = 48 * 1024
	for off := 0; off < len(zipBytes); off += chunkSize {
		end := off + chunkSize
		if end > len(zipBytes) {
			end = len(zipBytes)
		}
		if err := writeFrame(conn, map[string]any{"data": b64Encode(zipBytes[off:end])}); err != nil {
			return err
		}
	}
	rep, err := readFrame(conn)
	if err != nil {
		return err
	}
	if e, _ := rep["error"].(string); e != "" {
		return fmt.Errorf("%s", e)
	}
	return nil
}

func (r *runner) doVmShutdown(f frame) {
	id := f.str("identifier")
	archive, _ := f["archive"].(bool)
	r.vmsMu.Lock()
	vm := r.vms[id]
	r.vmsMu.Unlock()
	if vm == nil {
		return
	}
	if err := vm.shutdown(archive); err != nil {
		logf("vm %s shutdown: %v", id, err)
	}
	_ = r.send(frame{"type": "vmEvent", "identifier": id, "event": "stopped", "detail": "requested"})
}

// --- exec inside a VM -----------------------------------------------------------

func (r *runner) doVmExec(f frame) {
	callID := f.str("callId")
	id := f.str("identifier")
	r.vmsMu.Lock()
	vm := r.vms[id]
	r.vmsMu.Unlock()
	if vm == nil || vm.dead {
		_ = r.send(frame{"type": "result", "callId": callID, "error": "microvm not running (boot it first)"})
		return
	}
	vm.mu.Lock()
	vm.lastTouch = time.Now()
	vm.mu.Unlock()

	timeoutMs := f.num("timeoutMs")
	if timeoutMs == 0 {
		timeoutMs = 30000
	}
	rep, err := vm.agentCall(map[string]any{
		"op":         "exec",
		"command":    f.str("command"),
		"cwd":        f.str("cwd"),
		"timeoutMs": timeoutMs,
	}, time.Duration(timeoutMs)*time.Millisecond+10*time.Second)
	if err != nil {
		_ = r.send(frame{"type": "result", "callId": callID, "error": err.Error()})
		return
	}
	if e, _ := rep["error"].(string); e != "" {
		_ = r.send(frame{"type": "result", "callId": callID, "error": e})
		return
	}
	_ = r.send(frame{
		"type":     "result",
		"callId":   callID,
		"exitCode": intOf(rep["exitCode"]),
		"stdout":   strOf(rep["stdout"]),
		"stderr":   strOf(rep["stderr"]),
	})
}

func intOf(v any) int {
	f, _ := v.(float64)
	return int(f)
}

func strOf(v any) string {
	s, _ := v.(string)
	return s
}

func logf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[two-runner] "+format+"\n", args...)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// zip helpers (kept local: the guest agent produces the zip; the runner
// only ships bytes).
var _ = zip.NewWriter
