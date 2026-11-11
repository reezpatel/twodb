// Thin client over Dispatch's API — always through the gateway (dev proxy
// /dispatch-api → /apps/dispatch), so identity is the shared control-plane
// session resolved by TwoDB and forwarded as x-twodb-* headers.

export interface RunnerMeta {
  os?: string;
  arch?: string;
  hostname?: string;
  version?: string;
  pid?: number;
  [k: string]: unknown;
}

export interface Runner {
  id: string;
  name: string;
  kind: "host" | "microvm-host";
  status: "online" | "offline";
  meta: RunnerMeta;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface Job {
  id: string;
  runnerId: string;
  runnerName: string | null;
  resourceId: string | null;
  command: string;
  status: "running" | "completed" | "failed" | "terminated";
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface JobLogLine {
  seq: number;
  stream: "stdout" | "stderr";
  line: string;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface Microvm {
  id: string;
  identifier: string;
  runnerId: string;
  runnerName: string | null;
  status: "running" | "idle-stopped" | "archived" | "failed";
  cid: number | null;
  bootCount: number;
  lastActiveAt: string;
  createdAt: string;
  archivedAt: string | null;
}

const BASE = "/dispatch-api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `${res.status}` }))).error ?? `${res.status}`);
  return res.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => json<T>(r));
}

export const dispatchClient = {
  // --- runners ---------------------------------------------------------------
  listRunners(): Promise<Runner[]> {
    return fetch(`${BASE}/runners`, { credentials: "include" }).then((r) => json(r));
  },

  createRunner(input: { name?: string; kind?: "host" | "microvm-host" }): Promise<{ runner: Runner; key: string }> {
    return post("/runners", input);
  },

  deleteRunner(name: string): Promise<{ ok: boolean }> {
    return fetch(`${BASE}/runners/${encodeURIComponent(name)}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => json(r));
  },

  // --- exec / call -------------------------------------------------------------
  exec(input: {
    runnerId: string;
    resourceId?: string;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<ExecResult> {
    return post("/exec", input);
  },

  // --- jobs ---------------------------------------------------------------------
  createJob(input: {
    runnerId: string;
    resourceId?: string;
    command: string;
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<Job> {
    return post("/jobs", input);
  },

  listJobs(filter: { runnerId?: string; resourceId?: string; status?: string; limit?: number } = {}): Promise<Job[]> {
    const q = new URLSearchParams();
    if (filter.runnerId) q.set("runnerId", filter.runnerId);
    if (filter.resourceId) q.set("resourceId", filter.resourceId);
    if (filter.status) q.set("status", filter.status);
    if (filter.limit) q.set("limit", String(filter.limit));
    const qs = q.toString();
    return fetch(`${BASE}/jobs${qs ? `?${qs}` : ""}`, { credentials: "include" }).then((r) => json(r));
  },

  getJob(id: string): Promise<Job> {
    return fetch(`${BASE}/jobs/${id}`, { credentials: "include" }).then((r) => json(r));
  },

  terminateJob(id: string): Promise<Job> {
    return post(`/jobs/${id}/terminate`);
  },

  jobInput(id: string, input: { data?: string; eof?: boolean }): Promise<{ ok: boolean }> {
    return post(`/jobs/${id}/input`, input);
  },

  jobTail(id: string, lines?: number): Promise<{ lines: JobLogLine[] }> {
    const q = lines ? `?lines=${lines}` : "";
    return fetch(`${BASE}/jobs/${id}/tail${q}`, { credentials: "include" }).then((r) => json(r));
  },

  /** Live tail as SSE. onLog gets every line, onDone the terminal status. */
  tailFollow(id: string, onLog: (l: JobLogLine) => void, onDone: (status: string, exitCode: number | null) => void): () => void {
    const es = new EventSource(`${BASE}/jobs/${id}/tail?follow=1`, { withCredentials: true });
    es.addEventListener("log", (e) => onLog(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("done", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { status: string; exitCode: number | null };
      onDone(d.status, d.exitCode);
      es.close();
    });
    es.onerror = () => es.close();
    return () => es.close();
  },

  // --- microvms ------------------------------------------------------------------
  /** Boot or resume by identifier — runnerId optional (server resolves the
   *  VM's runner, falling back to any online runner). */
  bootMicrovm(input: {
    runnerId?: string;
    identifier: string;
    memMb?: number;
    vcpu?: number;
    idleShutdownSec?: number;
  }): Promise<Microvm> {
    return post("/microvms/boot", input);
  },

  listMicrovms(): Promise<Microvm[]> {
    return fetch(`${BASE}/microvms`, { credentials: "include" }).then((r) => json(r));
  },

  vmExec(input: { runnerId: string; identifier: string; command: string; timeoutMs?: number }): Promise<ExecResult> {
    return post("/microvms/exec", input);
  },

  shutdownMicrovm(identifier: string, archive: boolean): Promise<Microvm> {
    return post(`/microvms/${encodeURIComponent(identifier)}/shutdown${archive ? "?archive=1" : ""}`);
  },

  /** Terminal/vscode relay URL — dial with a WebSocket; bytes flow raw. */
  vmStreamUrl(identifier: string, mode: "terminal" | "vscode"): string {
    return `${window.location.origin}/apps/dispatch/microvms/${encodeURIComponent(identifier)}/stream?mode=${mode}`;
  },
};
