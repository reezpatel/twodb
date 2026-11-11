// two-runner — the machine-side agent for Dispatch.
//
// One process, one WebSocket (through the TwoDB gateway's WS passthrough),
// one friendly name. Implements:
//
//   exec        one-shot command, buffered reply
//   call        streamed output chunks
//   jobCreate   detached long-running job (logs streamed line-by-line)
//   jobSignal   terminate
//   vmBoot      boot/resume a Firecracker microvm (this build: requires
//               /dev/kvm + firecracker binary; VMs talk vsock only)
//   vmExec      command inside a VM over vsock
//   vmStream    terminal (pty) or vscode relay into a VM over vsock
//
// Run:
//   two-runner --gateway http://localhost:6400 --key twodbrun_... [--name divine] [--microvm]
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type frame map[string]any

func main() {
	gateway := flag.String("gateway", "http://localhost:6400", "TwoDB gateway URL")
	key := flag.String("key", "", "runner key (twodbrun_...)")
	name := flag.String("name", "", "friendly runner name (defaults to hostname)")
	vmHost := flag.Bool("microvm", false, "also host Firecracker microvms (needs /dev/kvm)")
	stateDir := flag.String("state", "", "state dir for microvms (default ~/.two-runner)")
	flag.Parse()

	if *key == "" {
		fmt.Fprintln(os.Stderr, "two-runner: --key is required")
		flag.Usage()
		os.Exit(2)
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

	r := &runner{
		gateway:       *gateway,
		key:           *key,
		name:          *name,
		microvm:       *vmHost,
		stateDir:      dir,
		jobs:          map[string]*os.Process{},
		calls:         map[string]*callState{},
		vms:           map[string]*microvm{},
		resultWaiters: map[string]chan map[string]any{},
	}
	globalRunner = r

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
