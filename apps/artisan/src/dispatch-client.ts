import type { ArtisanConfig } from "./config.js";

/**
 * Dispatch client — runners + exec/calls/jobs. Artisan calls dispatch with
 * the workspace API key (dispatch re-checks it against its own token space
 * via the forwarded gateway identity; direct calls use the key directly).
 */
export interface RunnerInfo {
  id: string;
  name: string;
  status: "online" | "offline";
  kind: "host" | "microvm-host";
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

export interface JobInfo {
  id: string;
  runnerId: string;
  resourceId: string | null;
  command: string;
  status: "running" | "completed" | "failed" | "terminated";
  exitCode: number | null;
}

export class DispatchClient {
  constructor(
    private readonly config: ArtisanConfig,
    private readonly apiKey: string,
  ) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.config.DISPATCH_URL}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
    if (!res.ok) throw new Error(`dispatch ${path} ${res.status}: ${json.error ?? json.message ?? ""}`);
    return json;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.DISPATCH_URL}${path}`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
    if (!res.ok) throw new Error(`dispatch ${path} ${res.status}: ${json.error ?? json.message ?? ""}`);
    return json;
  }

  async listRunners(): Promise<RunnerInfo[]> {
    return this.get<RunnerInfo[]>("/runners");
  }

  /** One-shot exec with cwd — files, quick reads. */
  async exec(runner: string, command: string, cwd: string, timeoutMs = 60_000): Promise<ExecResult> {
    return this.post<ExecResult>("/exec", { runnerId: runner, command, cwd, timeoutMs });
  }

  /** Streamed call — yields output chunks; the last yield carries done/exitCode.
   *  Dispatch SSE uses `event:` lines (output|done|error) with `chunk` payloads. */
  async *call(runner: string, command: string, cwd: string, timeoutMs = 600_000): AsyncGenerator<{ stream: "stdout" | "stderr"; data: string; done?: boolean; exitCode?: number | null }> {
    const { callId } = await this.post<{ callId: string }>("/calls", { runnerId: runner, command, cwd, timeoutMs });
    const res = await fetch(`${this.config.DISPATCH_URL}/calls/${callId}/stream`, {
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok || !res.body) throw new Error(`dispatch stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let event = "message";
    let exitCode: number | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const trimmed = line.trim();
        if (!trimmed) { event = "message"; continue; }
        if (trimmed.startsWith("event:")) {
          event = trimmed.slice(6).trim();
          continue;
        }
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as { stream?: string; chunk?: string; exitCode?: number; error?: string };
          if (event === "done") {
            exitCode = parsed.exitCode ?? null;
            yield { stream: "stdout", data: "", done: true, exitCode };
            return;
          }
          if (event === "error") throw new Error(parsed.error ?? "call failed");
          if (parsed.chunk) {
            yield { stream: (parsed.stream as "stdout" | "stderr") ?? "stdout", data: parsed.chunk };
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "call failed" && !(e instanceof SyntaxError)) throw e;
          // keepalive / malformed — skip
        }
        event = "message";
      }
    }
    // Stream closed without an explicit done (replay path) — treat as complete.
    if (exitCode === null) yield { stream: "stdout", data: "", done: true, exitCode: null };
  }

  /** Proxy one HTTP request to a localhost port on a runner (code-server). */
  async proxyHttp(runner: string, req: { port: number; method: string; path: string; headers?: Record<string, string>; bodyBase64?: string }): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    const res = await fetch(`${this.config.DISPATCH_URL}/runners/${encodeURIComponent(runner)}/proxy-http`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(req),
    });
    // Pass the upstream status through verbatim: code-server legitimately
    // answers 404 for files that don't ship in the standalone tarball (browser
    // extension entry points, notebook webview preloads), and the workbench
    // falls back on a clean 404 — a 502 would read as "server dead". Only 5xx
    // from dispatch itself (runner unreachable / proxy failed) is an error.
    if (res.status >= 500) throw new Error(`proxy-http ${res.status}`);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers, body: buf.toString("base64") };
  }

  async createJob(runner: string, command: string, cwd: string, resourceId?: string): Promise<JobInfo> {
    return this.post<JobInfo>("/jobs", { runnerId: runner, command, cwd, resourceId });
  }

  /** Lists recent jobs for a runner — accepts the runner NAME (sessions store
   *  names) or its internal id; resolves name → id via /runners. */
  /** Lists recent jobs for a runner — optionally scoped to a session via the
   *  dispatch `resourceId` (= artisan session id) that job_start stamps on the job. */
  async listJobs(runner: string, sessionId?: string): Promise<Array<JobInfo & { startedAt?: string; endedAt?: string | null; resourceId?: string | null }>> {
    let id = runner;
    if (!/^01/.test(runner)) {
      const runners = await this.listRunners().catch(() => [] as RunnerInfo[]);
      id = runners.find((r) => r.name === runner)?.id ?? runner;
    }
    const res = await this.get(`/jobs?runnerId=${encodeURIComponent(id)}&limit=30`);
    const list = (Array.isArray(res) ? res : []) as Array<JobInfo & { startedAt?: string; endedAt?: string | null; resourceId?: string | null }>;
    const scoped = sessionId ? list.filter((j) => j.resourceId === sessionId) : list;
    return scoped.slice(0, 12);
  }

  async getJob(id: string): Promise<JobInfo> {
    return this.get<JobInfo>(`/jobs/${id}`);
  }

  async terminateJob(id: string): Promise<void> {
    await fetch(`${this.config.DISPATCH_URL}/jobs/${id}/terminate`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
  }

  async jobInput(id: string, data: string, eof?: boolean): Promise<void> {
    await fetch(`${this.config.DISPATCH_URL}/jobs/${id}/input`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(eof ? { eof: true } : { data }),
    });
  }

  async jobLogs(id: string, afterSeq = 0): Promise<{ lines: Array<{ seq: number; stream: string; line: string }> }> {
    return this.get<{ lines: Array<{ seq: number; stream: string; line: string }> }>(`/jobs/${id}/tail?after=${afterSeq}`);
  }
}
