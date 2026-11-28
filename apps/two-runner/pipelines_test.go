package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// Drives a real pipelineRun through a fake gateway: asset GET from an "object store", upload-url round trip
// (pipelineUpload → result{urls}), PUT of the produced file, and the final result frame.
func TestPipelineRunVideoToAudio(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	tmp := t.TempDir()
	video := tmp + "/in.mp4"
	if out, err := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=d=1:s=64x64:r=10", "-f", "lavfi", "-i", "sine=f=440:d=1", "-shortest", "-pix_fmt", "yuv420p", video).CombinedOutput(); err != nil {
		t.Fatalf("making test video: %v %s", err, out)
	}
	videoBytes, _ := os.ReadFile(video)

	var mu sync.Mutex
	uploaded := map[string][]byte{}
	store := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodGet:
			_, _ = w.Write(videoBytes)
		case http.MethodPut:
			b, _ := io.ReadAll(req.Body)
			mu.Lock()
			uploaded[req.URL.Path] = b
			mu.Unlock()
		}
	}))
	defer store.Close()

	results := make(chan map[string]any, 1)
	up := websocket.Upgrader{}
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		c, err := up.Upgrade(w, req, nil)
		if err != nil {
			return
		}
		defer c.Close()
		var hello map[string]any
		_ = c.ReadJSON(&hello)
		_ = c.WriteJSON(map[string]any{"type": "helloAck", "name": "t", "workspaceId": "w"})
		_ = c.WriteJSON(map[string]any{
			"type": "pipelineRun", "callId": "c1", "runId": "run1", "pipeline": "video_to_audio",
			"params": map[string]any{"format": "wav", "mono": true},
			"assets": map[string]any{"video": map[string]any{"url": store.URL + "/in/movie.mp4", "name": "movie.mp4"}},
		})
		go func() {
			for {
				var f map[string]any
				if err := c.ReadJSON(&f); err != nil {
					return
				}
				switch f["type"] {
				case "pipelineUpload":
					var urls []map[string]any
					for _, it := range f["files"].([]any) {
						p := it.(map[string]any)["path"].(string)
						urls = append(urls, map[string]any{"path": p, "url": store.URL + "/out/" + p})
					}
					_ = c.WriteJSON(map[string]any{"type": "result", "callId": f["callId"], "urls": urls})
				case "result":
					results <- f
				}
			}
		}()
		time.Sleep(20 * time.Second)
	}))
	defer gw.Close()

	state := t.TempDir()
	r := &runner{
		gateway: gw.URL, key: "k", name: "t", stateDir: state,
		jobs: map[string]*jobHandle{}, calls: map[string]*callState{}, vms: map[string]*microvm{}, resultWaiters: map[string]chan map[string]any{},
		pipelinesOn: true, pipelinesDir: state + "/pipelines", pipelineSem: make(chan struct{}, 1),
	}
	if err := extractPipelines(r.pipelinesDir); err != nil {
		t.Fatal(err)
	}
	r.pipelines = loadPipelines(r.pipelinesDir)
	found := false
	for _, p := range r.pipelines {
		found = found || p.ID == "video_to_audio"
	}
	if !found {
		t.Fatalf("video_to_audio not loaded from the bundle (%d pipelines)", len(r.pipelines))
	}
	go func() { _ = r.connect() }()

	select {
	case res := <-results:
		if res["error"] != nil {
			t.Fatalf("run failed: %v\nstderr: %v", res["error"], res["stderr"])
		}
		b, _ := json.Marshal(res["output"])
		if !strings.Contains(string(b), `"file":"audio.wav"`) {
			t.Fatalf("unexpected output: %s", b)
		}
		files := res["files"].([]any)
		if len(files) != 1 || files[0].(map[string]any)["path"] != "audio.wav" {
			t.Fatalf("unexpected files: %v", files)
		}
		mu.Lock()
		defer mu.Unlock()
		if got := uploaded["/out/audio.wav"]; len(got) < 1000 || string(got[:4]) != "RIFF" {
			t.Fatalf("audio.wav not uploaded as wav (%d bytes)", len(got))
		}
		if _, err := os.Stat(state + "/pipelines"); err != nil {
			t.Fatal(err)
		}
	case <-time.After(30 * time.Second):
		t.Fatal("timed out")
	}
}

func TestPipelineRunRejectsBadIDs(t *testing.T) {
	for _, bad := range []string{"", "../x", "a/b", ".hidden"} {
		if !(bad == "" || strings.ContainsAny(bad, "/\\") || strings.HasPrefix(bad, ".")) {
			t.Fatalf("%q should be rejected", bad)
		}
	}
	if safeFileName("../../etc/passwd", "x") != "passwd" || safeFileName("..", "fb") != "fb" || safeFileName("", "fb") != "fb" {
		t.Fatal("safeFileName escapes")
	}
}

// go:embed drops file modes: every entrypoint, and every helper they exec, must come out executable.
func TestExtractedPipelinesAreExecutable(t *testing.T) {
	dir := t.TempDir() + "/p"
	if err := extractPipelines(dir); err != nil {
		t.Fatal(err)
	}
	for _, p := range loadPipelines(dir) {
		for _, f := range []string{p.ID + "/run", "_common/py"} {
			st, err := os.Stat(dir + "/" + f)
			if err != nil || st.Mode()&0o111 == 0 {
				t.Errorf("%s is not executable after extraction (%v, %v)", f, st, err)
			}
		}
	}
	if n := len(loadPipelines(dir)); n != 6 {
		t.Errorf("expected 6 bundled pipelines, got %d", n)
	}
}
