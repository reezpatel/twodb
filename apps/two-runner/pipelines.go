package main

// AI pipelines: the runner's "ai-pipelines" capability.
//
// A pipeline is a folder `<id>/` holding `manifest.json` and an executable `run`. The pipelines shipped with the runner
// are embedded in the binary (pipelines/) and extracted to <state>/pipelines on start, so pipeline code is versioned
// with the runner. The runner owns ALL asset I/O; pipeline code only ever sees local files:
//
//	pipelineRun {callId, runId, pipeline, params, assets, timeoutMs}
//	  1. mkdir workdir/{in,out}; download every asset url (presigned GET) into in/<param>/<name>
//	  2. write workdir/input.json = params + asset params replaced by local absolute paths (string | []string)
//	  3. run `<pipeline>/run` with cwd=workdir, env PIPELINE_INPUT / PIPELINE_IN_DIR / PIPELINE_OUT_DIR
//	  4. every file under out/ is uploaded: the runner asks Dispatch for presigned PUT urls
//	     (pipelineUpload {files:[{path,contentType}]} → result {urls:[{path,url}]}) and PUTs each file; out/result.json,
//	     when present, is returned as `output` instead of being uploaded
//	  5. reply result {output, files:[{path,size,contentType}], stdout, stderr, exitCode}
//
// Pipelines run one at a time per GPU-heavy machine would be a scheduler concern; for now at most
// TWO_RUNNER_PIPELINE_CONCURRENCY (default 1) run at once, the rest queue.

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"
)

//go:embed all:pipelines
var embeddedPipelines embed.FS

const defaultPipelineTimeout = 4 * time.Hour

type pipelineParam struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Required    bool     `json:"required,omitempty"`
	Options     []string `json:"options,omitempty"`
}

type pipelineManifest struct {
	ID          string                   `json:"id"`
	Version     string                   `json:"version"`
	Description string                   `json:"description"`
	Params      map[string]pipelineParam `json:"params"`
	// GPU marks pipelines that want the GPU (informational; advertised to Dispatch).
	GPU bool `json:"gpu,omitempty"`
}

// extractPipelines writes the embedded pipelines to dir (replacing previous content) and returns dir.
func extractPipelines(dir string) error {
	_ = os.RemoveAll(dir)
	return fs.WalkDir(embeddedPipelines, "pipelines", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel := strings.TrimPrefix(strings.TrimPrefix(p, "pipelines"), "/")
		if rel == "" {
			return os.MkdirAll(dir, 0o755)
		}
		dst := filepath.Join(dir, rel)
		if d.IsDir() {
			return os.MkdirAll(dst, 0o755)
		}
		b, err := embeddedPipelines.ReadFile(p)
		if err != nil {
			return err
		}
		// go:embed drops file modes, and entrypoints reach each other by exec (run -> _common/py), so only data files
		// (manifests, docs) stay non-executable; everything else is the runner's own code.
		mode := os.FileMode(0o755)
		if strings.HasSuffix(p, ".json") || strings.HasSuffix(p, ".md") || strings.HasSuffix(p, ".txt") {
			mode = 0o644
		}
		return os.WriteFile(dst, b, mode)
	})
}

// loadPipelines reads every <dir>/<id>/manifest.json that also has a `run` entrypoint.
func loadPipelines(dir string) []pipelineManifest {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []pipelineManifest
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name(), "manifest.json"))
		if err != nil {
			continue
		}
		var m pipelineManifest
		if json.Unmarshal(b, &m) != nil {
			continue
		}
		if m.ID == "" {
			m.ID = e.Name()
		}
		if m.ID != e.Name() {
			continue // folder name is the id
		}
		if _, err := os.Stat(filepath.Join(dir, e.Name(), "run")); err != nil {
			continue
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// hasNvidiaGPU reports the first GPU's name via nvidia-smi ("" when none).
func hasNvidiaGPU() string {
	out, err := exec.Command("nvidia-smi", "--query-gpu=name", "--format=csv,noheader").Output()
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(strings.SplitN(string(out), "\n", 2)[0])
	return line
}

type assetRef struct {
	URL  string `json:"url"`
	Name string `json:"name"`
}

// doPipelineRun executes one pipeline run (see the package comment). It always answers with a result frame.
func (r *runner) doPipelineRun(f frame) {
	callID := f.str("callId")
	fail := func(format string, a ...any) {
		_ = r.send(frame{"type": "result", "callId": callID, "exitCode": -1, "error": fmt.Sprintf(format, a...)})
	}
	if !r.pipelinesOn {
		fail("this runner has no ai-pipelines capability")
		return
	}
	id := f.str("pipeline")
	if id == "" || strings.ContainsAny(id, "/\\") || strings.HasPrefix(id, ".") {
		fail("invalid pipeline id %q", id)
		return
	}
	var manifest *pipelineManifest
	for i := range r.pipelines {
		if r.pipelines[i].ID == id {
			manifest = &r.pipelines[i]
		}
	}
	if manifest == nil {
		fail("unknown pipeline %q", id)
		return
	}

	// queue behind the concurrency limit
	r.pipelineSem <- struct{}{}
	defer func() { <-r.pipelineSem }()

	timeout := defaultPipelineTimeout
	if ms := f.num("timeoutMs"); ms > 0 {
		timeout = time.Duration(ms) * time.Millisecond
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	work, err := os.MkdirTemp(filepath.Join(r.stateDir), "run-")
	if err != nil {
		fail("workdir: %v", err)
		return
	}
	defer os.RemoveAll(work)
	inDir, outDir := filepath.Join(work, "in"), filepath.Join(work, "out")
	if err := os.MkdirAll(inDir, 0o755); err != nil {
		fail("workdir: %v", err)
		return
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		fail("workdir: %v", err)
		return
	}

	// --- inputs ---------------------------------------------------------------------------------------------
	input := map[string]any{}
	if p, ok := f["params"].(map[string]any); ok {
		for k, v := range p {
			input[k] = v
		}
	}
	if assets, ok := f["assets"].(map[string]any); ok {
		for param, raw := range assets {
			if strings.ContainsAny(param, "/\\") || strings.HasPrefix(param, ".") {
				fail("invalid asset param %q", param)
				return
			}
			var refs []assetRef
			single := false
			switch v := raw.(type) {
			case []any:
				for _, it := range v {
					refs = append(refs, toAssetRef(it))
				}
			default:
				refs = append(refs, toAssetRef(v))
				single = true
			}
			var paths []string
			for i, a := range refs {
				if a.URL == "" {
					fail("asset %q #%d has no url", param, i)
					return
				}
				name := safeFileName(a.Name, fmt.Sprintf("asset-%d", i))
				dst := filepath.Join(inDir, param, fmt.Sprintf("%03d", i), name)
				if err := downloadTo(ctx, a.URL, dst); err != nil {
					fail("downloading %s: %v", param, err)
					return
				}
				paths = append(paths, dst)
			}
			if single && len(paths) == 1 {
				input[param] = paths[0]
			} else {
				input[param] = paths
			}
		}
	}
	inputPath := filepath.Join(work, "input.json")
	ib, _ := json.Marshal(input)
	if err := os.WriteFile(inputPath, ib, 0o644); err != nil {
		fail("input.json: %v", err)
		return
	}

	// --- run ------------------------------------------------------------------------------------------------
	cmd := exec.CommandContext(ctx, filepath.Join(r.pipelinesDir, id, "run"))
	cmd.Dir = work
	cmd.Env = append(spawnEnv(),
		"PIPELINE_INPUT="+inputPath, "PIPELINE_IN_DIR="+inDir, "PIPELINE_OUT_DIR="+outDir,
		"PIPELINE_DIR="+filepath.Join(r.pipelinesDir, id), "PIPELINE_CACHE="+filepath.Join(r.stateDir, "pipeline-cache"),
		"HF_HOME="+filepath.Join(r.stateDir, "pipeline-cache", "hf"),
	)
	// Python wheels (numpy, opencv, onnxruntime, CUDA libs) need libstdc++/zlib/libcuda on NixOS: the module sets this.
	if lp := strings.TrimSpace(os.Getenv("TWO_RUNNER_PIPELINE_LD_LIBRARY_PATH")); lp != "" {
		cmd.Env = append(cmd.Env, "LD_LIBRARY_PATH="+lp+":"+os.Getenv("LD_LIBRARY_PATH"))
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	var stdout, stderr tailBuffer
	stdout.max, stderr.max = 64*1024, 64*1024
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	runErr := cmd.Run()
	exit := exitCode(runErr)
	if ctx.Err() == context.DeadlineExceeded {
		_ = r.send(frame{"type": "result", "callId": callID, "exitCode": -1, "error": fmt.Sprintf("pipeline timed out after %s", timeout), "stdout": stdout.String(), "stderr": stderr.String()})
		return
	}
	if runErr != nil {
		_ = r.send(frame{"type": "result", "callId": callID, "exitCode": exit, "error": fmt.Sprintf("pipeline failed (exit %d)", exit), "stdout": stdout.String(), "stderr": stderr.String()})
		return
	}

	// --- outputs --------------------------------------------------------------------------------------------
	var output any
	if b, err := os.ReadFile(filepath.Join(outDir, "result.json")); err == nil {
		if json.Unmarshal(b, &output) != nil {
			output = string(b)
		}
	}
	var files []map[string]any
	var rels []string
	_ = filepath.WalkDir(outDir, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(outDir, p)
		rel = filepath.ToSlash(rel)
		if rel != "result.json" {
			rels = append(rels, rel)
		}
		return nil
	})
	sort.Strings(rels)
	ctype := func(rel string) string {
		if t := mime.TypeByExtension(strings.ToLower(filepath.Ext(rel))); t != "" {
			return t
		}
		return "application/octet-stream"
	}
	const batch = 100
	for i := 0; i < len(rels); i += batch {
		end := i + batch
		if end > len(rels) {
			end = len(rels)
		}
		var req []map[string]any
		for _, rel := range rels[i:end] {
			req = append(req, map[string]any{"path": rel, "contentType": ctype(rel)})
		}
		urls, err := r.requestUploadURLs(ctx, f.str("runId"), req)
		if err != nil {
			fail("requesting upload urls: %v", err)
			return
		}
		for _, rel := range rels[i:end] {
			u := urls[rel]
			if u == "" {
				fail("no upload url returned for %s", rel)
				return
			}
			size, err := putFile(ctx, u, filepath.Join(outDir, filepath.FromSlash(rel)), ctype(rel))
			if err != nil {
				fail("uploading %s: %v", rel, err)
				return
			}
			files = append(files, map[string]any{"path": rel, "size": size, "contentType": ctype(rel)})
		}
	}
	_ = r.send(frame{"type": "result", "callId": callID, "exitCode": 0, "output": output, "files": files, "stdout": stdout.String(), "stderr": stderr.String()})
}

// requestUploadURLs asks Dispatch (→ Toolkit) for presigned PUT urls and returns path → url.
func (r *runner) requestUploadURLs(ctx context.Context, runID string, files []map[string]any) (map[string]string, error) {
	id := fmt.Sprintf("up-%d", time.Now().UnixNano())
	ch := make(chan map[string]any, 1)
	r.expectResult(id, ch)
	defer func() {
		r.waitersMu.Lock()
		delete(r.resultWaiters, id)
		r.waitersMu.Unlock()
	}()
	if err := r.send(frame{"type": "pipelineUpload", "callId": id, "runId": runID, "files": files}); err != nil {
		return nil, err
	}
	select {
	case res := <-ch:
		if e, _ := res["error"].(string); e != "" {
			return nil, fmt.Errorf("%s", e)
		}
		out := map[string]string{}
		if list, ok := res["urls"].([]any); ok {
			for _, it := range list {
				if m, ok := it.(map[string]any); ok {
					p, _ := m["path"].(string)
					u, _ := m["url"].(string)
					out[p] = u
				}
			}
		}
		return out, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(2 * time.Minute):
		return nil, fmt.Errorf("timed out waiting for upload urls")
	}
}

func toAssetRef(v any) assetRef {
	m, _ := v.(map[string]any)
	a := assetRef{}
	a.URL, _ = m["url"].(string)
	a.Name, _ = m["name"].(string)
	return a
}

// safeFileName keeps a base name only (no separators / dot segments).
func safeFileName(name, fallback string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	if name == "" || name == "." || name == ".." || name == "/" {
		return fallback
	}
	return name
}

var transferClient = &http.Client{Timeout: 0} // bounded by the run context, not a fixed deadline

func downloadTo(ctx context.Context, url, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	res, err := transferClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 300))
		return fmt.Errorf("GET answered %d: %s", res.StatusCode, strings.TrimSpace(string(b)))
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, res.Body); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func putFile(ctx context.Context, url, path, contentType string) (int64, error) {
	fh, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer fh.Close()
	st, err := fh.Stat()
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, fh)
	if err != nil {
		return 0, err
	}
	req.ContentLength = st.Size()
	req.Header.Set("Content-Type", contentType)
	res, err := transferClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 300))
		return 0, fmt.Errorf("PUT answered %d: %s", res.StatusCode, strings.TrimSpace(string(b)))
	}
	return st.Size(), nil
}

// tailBuffer keeps the last `max` bytes written (pipelines can be chatty for hours).
type tailBuffer struct {
	buf bytes.Buffer
	max int
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.buf.Write(p)
	if over := t.buf.Len() - t.max; over > 0 {
		t.buf.Next(over)
	}
	return len(p), nil
}

func (t *tailBuffer) String() string { return t.buf.String() }

func pipelineConcurrency() int {
	if n, err := strconv.Atoi(strings.TrimSpace(os.Getenv("TWO_RUNNER_PIPELINE_CONCURRENCY"))); err == nil && n > 0 {
		return n
	}
	return 1
}

