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
      headers: { "x-api-key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
    if (!res.ok) throw new Error(`dispatch ${path} ${res.status}: ${json.error ?? json.message ?? ""}`);
    return json;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.DISPATCH_URL}${path}`, {
      headers: { "x-api-key": this.apiKey },
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
      headers: { "x-api-key": this.apiKey },
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

  async createJob(runner: string, command: string, cwd: string, resourceId?: string): Promise<JobInfo> {
    return this.post<JobInfo>("/jobs", { runnerId: runner, command, cwd, resourceId });
  }

  /** Lists recent jobs for a runner — accepts the runner NAME (sessions store
   *  names) or its internal id; resolves name → id via /runners. */
  async listJobs(runner: string): Promise<Array<JobInfo & { startedAt?: string; endedAt?: string | null }>> {
    let id = runner;
    if (!/^01/.test(runner)) {
      const runners = await this.listRunners().catch(() => [] as RunnerInfo[]);
      id = runners.find((r) => r.name === runner)?.id ?? runner;
    }
    return this.get(`/jobs?runnerId=${encodeURIComponent(id)}&limit=12`);
  }

  async getJob(id: string): Promise<JobInfo> {
    return this.get<JobInfo>(`/jobs/${id}`);
  }

  async terminateJob(id: string): Promise<void> {
    await fetch(`${this.config.DISPATCH_URL}/jobs/${id}/terminate`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey },
    });
  }

  async jobInput(id: string, data: string, eof?: boolean): Promise<void> {
    await fetch(`${this.config.DISPATCH_URL}/jobs/${id}/input`, {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify(eof ? { eof: true } : { data }),
    });
  }

  async jobLogs(id: string, afterSeq = 0): Promise<{ lines: Array<{ seq: number; stream: string; line: string }> }> {
    return this.get<{ lines: Array<{ seq: number; stream: string; line: string }> }>(`/jobs/${id}/tail?after=${afterSeq}`);
  }
}
