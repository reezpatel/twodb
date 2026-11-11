import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

const runnerSummary = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["host", "microvm-host"]),
  status: z.enum(["online", "offline"]),
  meta: z.record(z.string(), z.unknown()),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
});

const jobSummary = z.object({
  id: z.string(),
  runnerId: z.string(),
  runnerName: z.string().nullable(),
  resourceId: z.string().nullable(),
  command: z.string(),
  status: z.enum(["running", "completed", "failed", "terminated"]),
  exitCode: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});

const microvmSummary = z.object({
  id: z.string(),
  identifier: z.string(),
  runnerId: z.string(),
  runnerName: z.string().nullable(),
  status: z.enum(["running", "idle-stopped", "archived", "failed"]),
  cid: z.number().nullable(),
  bootCount: z.number(),
  lastActiveAt: z.string(),
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
});

const execRequest = z.object({
  /** Friendly runner identifier. */
  runnerId: z.string(),
  /** Caller grouping key — stored with every exec/job for filtering. */
  resourceId: z.string().optional(),
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().positive().max(600_000).optional(),
});

const execResult = z.object({
  exitCode: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number(),
});

const jobCreateRequest = z.object({
  runnerId: z.string(),
  resourceId: z.string().optional(),
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const vmRequest = z.object({
  runnerId: z.string(),
  /** Stable microvm identifier — same id resumes (restores /app). */
  identifier: z.string(),
});

const vmExecRequest = vmRequest.extend({
  command: z.string(),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().max(600_000).optional(),
});

const vmBootRequest = z.object({
  /** Optional — the server resolves the VM's runner (resume) or falls back
   *  to any online runner. */
  runnerId: z.string().optional(),
  /** Stable microvm identifier — same id resumes (restores /app). */
  identifier: z.string(),
  memMb: z.number().int().positive().max(8192).optional(),
  vcpu: z.number().int().positive().max(8).optional(),
  idleShutdownSec: z.number().int().positive().max(86_400).optional(),
});


export const dispatchManifest = defineAppManifest({
  name: "Dispatch",
  slug: "dispatch",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "Runner manager: remote command exec (one-shot + streamed), long-running jobs with tail/SSE follow, " +
    "and ephemeral Firecracker microvms with a persistent /app that survives shutdown (zipped to S3 on " +
    "shutdown, restored on resume, archived after a configurable inactivity window). Runners connect over " +
    "a long-lived WebSocket and carry a friendly, workspace-unique identifier.",
  capabilities: ["exec"],
  coreDeps: ["core-data", "core-platform"],
  basePath: "/apps/dispatch",
  endpoints: [
    // --- runners --------------------------------------------------------------
    defineEndpoint({
      name: "createRunner",
      method: "POST",
      path: "/runners",
      auth: "session-or-apiKey",
      description:
        "Creates a runner entry and returns its key (twodbrun_...) exactly once — the runner presents " +
        "this key on its WebSocket connect. Optionally give a friendly name; one is generated otherwise.",
      request: z.object({
        name: z.string().min(1).max(40).optional(),
        kind: z.enum(["host", "microvm-host"]).optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
      response: z.object({ runner: runnerSummary, key: z.string() }),
    }),
    defineEndpoint({
      name: "listRunners",
      method: "GET",
      path: "/runners",
      auth: "session-or-apiKey",
      description: "All runners in the workspace with online status and host metadata.",
      response: z.array(runnerSummary),
    }),
    defineEndpoint({
      name: "deleteRunner",
      method: "DELETE",
      path: "/runners/:name",
      auth: "session-or-apiKey",
      description: "Removes a runner and revokes its key (its WS is dropped if online).",
      request: z.object({ name: z.string() }),
      response: z.object({ ok: z.boolean() }),
    }),
    // --- enrollment tokens ------------------------------------------------------
    defineEndpoint({
      name: "createEnrollToken",
      method: "POST",
      path: "/enroll-tokens",
      auth: "session-or-apiKey",
      description:
        "Creates a shared enrollment token (twodbenroll_..., shown exactly once). Any " +
        "number of machines can present it via two-runner --enroll; each gets its own " +
        "runner identity + per-runner key. Optional expiresInDays.",
      request: z.object({ name: z.string().min(1).max(40).optional(), expiresInDays: z.number().int().positive().max(365).optional() }),
      response: z.object({
        token: z.object({
          id: z.string(),
          name: z.string(),
          enrollCount: z.number(),
          lastUsedAt: z.string().nullable(),
          expiresAt: z.string().nullable(),
          createdAt: z.string(),
        }),
        key: z.string(),
      }),
    }),
    defineEndpoint({
      name: "listEnrollTokens",
      method: "GET",
      path: "/enroll-tokens",
      auth: "session-or-apiKey",
      description: "Enrollment tokens with usage counts (never the token values).",
      response: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          enrollCount: z.number(),
          lastUsedAt: z.string().nullable(),
          expiresAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
    defineEndpoint({
      name: "deleteEnrollToken",
      method: "DELETE",
      path: "/enroll-tokens/:id",
      auth: "session-or-apiKey",
      description: "Revokes an enrollment token (no new machines can join with it).",
      request: z.object({ id: z.string() }),
      response: z.object({ ok: z.boolean() }),
    }),
    // --- exec / call ---------------------------------------------------------
    defineEndpoint({
      name: "execCommand",
      method: "POST",
      path: "/exec",
      auth: "session-or-apiKey",
      description:
        "Runs a one-shot command on a runner and returns the collected stdout/stderr + exit code. " +
        "The whole output is buffered on the runner before it answers.",
      request: execRequest,
      response: execResult,
    }),
    defineEndpoint({
      name: "callCommand",
      method: "POST",
      path: "/calls",
      auth: "session-or-apiKey",
      description:
        "Starts a command on a runner and returns a callId immediately; subscribe to " +
        "GET /calls/:callId/stream (SSE) for live output chunks and the done frame. " +
        "Chosen when output is large or long-lived; execCommand otherwise.",
      request: execRequest,
      response: z.object({ callId: z.string(), runnerName: z.string() }),
    }),
    defineEndpoint({
      name: "streamCall",
      method: "GET",
      path: "/calls/:callId/stream",
      auth: "session-or-apiKey",
      description:
        "SSE stream of a call's output: one `data:` frame per output chunk ({stream:'stdout'|'stderr', " +
        "chunk}) and a final {done, exitCode}. Replays chunks recorded before the subscribe (kept in " +
        "memory) so slow joiners see the full transcript.",
      request: z.object({ callId: z.string() }),
      streaming: true,
      response: z.string(),
    }),
    // --- jobs -----------------------------------------------------------------
    defineEndpoint({
      name: "createJob",
      method: "POST",
      path: "/jobs",
      auth: "session-or-apiKey",
      description:
        "Starts a long-running job (detached) on a runner. Returns immediately with the job id; " +
        "logs stream to GET /jobs/:id/tail.",
      request: jobCreateRequest,
      response: jobSummary,
    }),
    defineEndpoint({
      name: "listJobs",
      method: "GET",
      path: "/jobs",
      auth: "session-or-apiKey",
      description: "Jobs in the workspace, newest first; filter by runnerId/resourceId/status.",
      request: z.object({
        runnerId: z.string().optional(),
        resourceId: z.string().optional(),
        status: z.enum(["running", "completed", "failed", "terminated"]).optional(),
        limit: z.coerce.number().int().positive().max(500).optional(),
      }),
      response: z.array(jobSummary),
    }),
    defineEndpoint({
      name: "getJob",
      method: "GET",
      path: "/jobs/:id",
      auth: "session-or-apiKey",
      description: "Job status by id.",
      request: z.object({ id: z.string() }),
      response: jobSummary,
    }),
    defineEndpoint({
      name: "terminateJob",
      method: "POST",
      path: "/jobs/:id/terminate",
      auth: "session-or-apiKey",
      description: "Terminates a running job (SIGTERM then SIGKILL on the runner).",
      request: z.object({ id: z.string() }),
      response: jobSummary,
    }),
    defineEndpoint({
      name: "jobInput",
      method: "POST",
      path: "/jobs/:id/input",
      auth: "session-or-apiKey",
      description:
        "Feeds stdin to a running job: {data} appends bytes; {eof:true} closes the " +
        "job's stdin (EOF for the program). For interactive jobs — REPLs, confirmation " +
        "prompts, anything that reads stdin mid-run.",
      request: z.object({ id: z.string(), data: z.string().optional(), eof: z.boolean().optional() }),
      response: z.object({ ok: z.boolean() }),
    }),
    defineEndpoint({
      name: "tailJob",
      method: "GET",
      path: "/jobs/:id/tail",
      auth: "session-or-apiKey",
      description:
        "Job log tail. Without follow: current buffer, up to `lines`. With follow=1: SSE that " +
        "replays then keeps streaming new lines until the job ends.",
      request: z.object({
        id: z.string(),
        lines: z.coerce.number().int().positive().max(10_000).optional(),
        follow: z.coerce.number().int().min(0).max(1).optional(),
      }),
      streaming: true,
      response: z.string(),
    }),
    // --- microvms ------------------------------------------------------------
    defineEndpoint({
      name: "bootMicrovm",
      method: "POST",
      path: "/microvms/boot",
      auth: "session-or-apiKey",
      description:
        "Boots an ephemeral Firecracker microvm on a microvm-host runner. If the identifier was " +
        "never used (or is past the archive window), boots fresh; if it was idle-stopped, resumes " +
        "it — /app is restored from its S3 zip first. The VM auto-shuts-down after idleShutdownSec " +
        "of inactivity (zipping /app back to S3), and a command to the same identifier resumes it.",
      request: vmBootRequest,
      response: microvmSummary,
    }),
    defineEndpoint({
      name: "execInMicrovm",
      method: "POST",
      path: "/microvms/exec",
      auth: "session-or-apiKey",
      description:
        "Runs a command inside a microvm (booting/resuming it if needed) over vsock and returns " +
        "the buffered output. Marks the VM active (resets its idle timer).",
      request: vmExecRequest,
      response: execResult,
    }),
    defineEndpoint({
      name: "listMicrovms",
      method: "GET",
      path: "/microvms",
      auth: "session-or-apiKey",
      description: "Microvms in the workspace with lifecycle status.",
      response: z.array(microvmSummary),
    }),
    defineEndpoint({
      name: "microvmStream",
      method: "GET",
      path: "/microvms/:identifier/stream",
      auth: "session-or-apiKey",
      description:
        "Raw WS relay to a microvm's terminal (pty bytes in both directions) or its VSCode fork " +
        "(code-server): ?mode=terminal|vscode. Runners host the relay over vsock; dispatch bridges " +
        "it to callers through the Gateway's WS passthrough.",
      request: z.object({ identifier: z.string(), mode: z.enum(["terminal", "vscode"]) }),
      streaming: true,
      response: z.string(),
    }),
    defineEndpoint({
      name: "shutdownMicrovm",
      method: "POST",
      path: "/microvms/:identifier/shutdown",
      auth: "session-or-apiKey",
      description:
        "Shuts a microvm down gracefully: zips /app, uploads to S3 (stub), powers off. Same-identifier " +
        "resume restores /app. Pass archive=1 to also sweep it for archive after inactivity.",
      request: z.object({ identifier: z.string(), archive: z.coerce.number().int().min(0).max(1).optional() }),
      response: microvmSummary,
    }),
  ],
});

export default dispatchManifest;
