// two-runner — the machine-side agent for Dispatch.
//
// One process, one WebSocket (through the TwoDB gateway's WS passthrough),
// one friendly name. Implements:
//
//	exec        one-shot command, buffered reply
//	call        streamed output chunks
//	jobCreate   detached long-running job (logs streamed line-by-line)
//	jobSignal   terminate
//	vmBoot      boot/resume a Firecracker microvm (this build: requires
//	            /dev/kvm + firecracker binary; VMs talk vsock only)
//	vmExec      command inside a VM over vsock
//	vmStream    terminal (pty) or vscode relay into a VM over vsock
//
// Run:
//
//	two-runner --gateway http://localhost:6400 --key twodbrun_... [--name divine] [--microvm]
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

type frame map[string]any

// version is stamped at build time (-ldflags "-X main.version=...").
var version = "dev"

// envOr returns the first non-empty environment variable, else def.
func envOr(def string, names ...string) string {
	for _, n := range names {
		if v := strings.TrimSpace(os.Getenv(n)); v != "" {
			return v
		}
	}
	return def
}

// readSecretFile returns the trimmed content of a secret file ("" when path is empty).
func readSecretFile(path string) string {
	if path == "" {
		return ""
	}
	b, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("two-runner: cannot read %s: %v", path, err)
	}
	return strings.TrimSpace(string(b))
}

func main() {
	// Every flag also has an environment variable (TWO_RUNNER_*), so a service manager can configure it declaratively.
	gateway := flag.String("gateway", envOr("http://localhost:6400", "TWO_RUNNER_GATEWAY"), "TwoDB gateway URL (env TWO_RUNNER_GATEWAY). Any address that reaches the gateway works, e.g. a private NetBird IP")
	key := flag.String("key", envOr("", "TWO_RUNNER_KEY"), "runner key (twodbrun_...) (env TWO_RUNNER_KEY)")
	keyFile := flag.String("key-file", envOr("", "TWO_RUNNER_KEY_FILE"), "file holding the runner key (env TWO_RUNNER_KEY_FILE)")
	enroll := flag.String("enroll", envOr("", "TWO_RUNNER_ENROLL"), "enrollment token (twodbenroll_...) — used only while the runner has no key yet; the minted key is persisted and reused (env TWO_RUNNER_ENROLL)")
	enrollFile := flag.String("enroll-file", envOr("", "TWO_RUNNER_ENROLL_FILE"), "file holding the enrollment token (env TWO_RUNNER_ENROLL_FILE)")
	name := flag.String("name", envOr("", "TWO_RUNNER_NAME"), "friendly runner name, defaults to the hostname (env TWO_RUNNER_NAME)")
	vmHost := flag.Bool("microvm", envOr("", "TWO_RUNNER_MICROVM") == "true", "also host Firecracker microvms (needs /dev/kvm) (env TWO_RUNNER_MICROVM=true)")
	pipelinesOn := flag.Bool("pipelines", envOr("", "TWO_RUNNER_PIPELINES") == "true", "enable the ai-pipelines capability: run the bundled AI pipelines (ffmpeg, whisper, OCR...) for Dispatch/Toolkit (env TWO_RUNNER_PIPELINES=true)")
	pipelinesDir := flag.String("pipelines-dir", envOr("", "TWO_RUNNER_PIPELINES_DIR"), "directory of pipelines to serve; default: the bundled ones extracted to <state>/pipelines (env TWO_RUNNER_PIPELINES_DIR)")
	stateDir := flag.String("state", envOr("", "TWO_RUNNER_STATE"), "state dir: runner key + microvms (default ~/.two-runner) (env TWO_RUNNER_STATE)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("two-runner", version)
		return
	}

	keyVal := *key
	if keyVal == "" {
		keyVal = readSecretFile(*keyFile)
	}
	enrollVal := *enroll
	if enrollVal == "" {
		enrollVal = readSecretFile(*enrollFile)
	}

	if *name == "" {
		h, _ := os.Hostname()
		*name = h
	}

	dir := *stateDir
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("no state dir: %v", err)
		}
		dir = home + "/.two-runner"
	}

	// Runner key resolution: explicit --key/--key-file > the key persisted by a previous enrollment > enroll.
	// The enrollment token is ONLY used when there is no key: Dispatch mints a NEW runner on every enrollment, so a
	// service that always passes the token must not re-enroll on each restart.
	persisted := dir + "/runner.key"
	fromPersisted := false
	if keyVal == "" {
		if b, err := os.ReadFile(persisted); err == nil && strings.TrimSpace(string(b)) != "" {
			keyVal = strings.TrimSpace(string(b))
			fromPersisted = true
			log.Printf("using persisted runner key from %s", persisted)
		}
	}
	if keyVal == "" && enrollVal == "" {
		fmt.Fprintln(os.Stderr, "two-runner: a runner key (--key/--key-file) or an enrollment token (--enroll/--enroll-file) is required")
		flag.Usage()
		os.Exit(2)
	}
	useEnroll := ""
	if keyVal == "" {
		useEnroll = enrollVal
	}

	r := &runner{
		gateway:     *gateway,
		key:         keyVal,
		enrollToken: useEnroll,
		// If a persisted key is later rejected (runner deleted in Dispatch), enroll again instead of looping forever.
		enrollFallback: map[bool]string{true: enrollVal, false: ""}[fromPersisted],
		keyPath:        persisted,
		name:           *name,
		microvm:        *vmHost,
		stateDir:       dir,
		jobs:           map[string]*jobHandle{},
		calls:          map[string]*callState{},
		vms:            map[string]*microvm{},
		resultWaiters:  map[string]chan map[string]any{},
	}
	globalRunner = r

	if *pipelinesOn {
		pdir := *pipelinesDir
		if pdir == "" {
			pdir = dir + "/pipelines"
			if err := extractPipelines(pdir); err != nil {
				log.Fatalf("extracting bundled pipelines to %s: %v", pdir, err)
			}
		}
		r.pipelinesOn, r.pipelinesDir = true, pdir
		r.gpu = hasNvidiaGPU()
		r.pipelineSem = make(chan struct{}, pipelineConcurrency())
		log.Printf("ai-pipelines enabled: %d pipelines in %s (gpu: %q)", len(loadPipelines(pdir)), pdir, r.gpu)
	}

	if *vmHost {
		if err := r.initMicrovmHost(); err != nil {
			log.Printf("microvm hosting disabled: %v", err)
			r.microvm = false
		}
	}

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)

	for {
		err := r.connect()
		if err != nil {
			log.Printf("ws: %v — retrying in 5s", err)
		}
		select {
		case <-interrupt:
			log.Println("shutting down")
			r.shutdownAll()
			return
		case <-time.After(5 * time.Second):
		}
	}
}

// frame helpers ---------------------------------------------------------------

func (f frame) str(k string) string {
	if v, ok := f[k].(string); ok {
		return v
	}
	return ""
}

func (f frame) num(k string) int {
	switch v := f[k].(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return 0
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
