import { useCallback, useEffect, useState } from "react";
import type { SessionDetail } from "../../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../../lib/workspace-ws.js";
import { apiFetch } from "../../../lib/artisan-client.js";

/** Right-sidebar data: git status, subagents, checkpoints (plan comes from the chat hook). */

export interface GitInfo {
  git: boolean;
  branch?: string;
  additions?: number;
  deletions?: number;
  files?: Array<{ path: string; status: string }>;
}

export interface ChildSession {
  id: string;
  title: string;
  running: boolean;
  adhoc: boolean;
  updatedAt: string;
}

export interface JobRow {
  id: string;
  command: string;
  status: string;
  exitCode: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  label: string | null;
  commitSha: string;
  trigger: string;
  createdAt: string;
}

export function useSessionSide(sessionId: string) {
  const { onFrame } = useWorkspaceWs();
  const [git, setGit] = useState<GitInfo | null>(null);
  const [children, setChildren] = useState<ChildSession[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [plan, setPlan] = useState<Array<{ description: string; status: string }> | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [g, c, cp, detail] = await Promise.all([
        apiFetch(`/sessions/${sessionId}/git`).then((r) => (r.ok ? r.json() : null)),
        apiFetch(`/sessions/${sessionId}/children`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`/sessions/${sessionId}/checkpoints`).then((r) => (r.ok ? r.json() : [])),
        apiFetch(`/sessions/${sessionId}`).then((r) => (r.ok ? r.json() : null)),
      ]);
      setGit(g);
      setChildren(c);
      setCheckpoints(cp);
      setPlan((detail as { plan?: Array<{ description: string; status: string }> | null } | null)?.plan ?? null);
    } catch {
      // offline
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    const pollJobs = () => {
      apiFetch(`/sessions/${sessionId}/jobs`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setJobs)
        .catch(() => {});
    };
    pollJobs();
    const tJobs = setInterval(pollJobs, 6_000);
    return () => {
      clearInterval(t);
      clearInterval(tJobs);
    };
  }, [refresh, sessionId]);

  // Live updates: apply the plan (and other session frames) the moment the agent
  // emits them — the 15s poll alone leaves the sidebar stale mid-run.
  useEffect(() => {
    const off = onFrame((frame) => {
      if (frame.sessionId !== sessionId) return;
      if (frame.type === "plan") {
        setPlan((frame.plan as Array<{ description: string; status: string }> | null) ?? null);
      } else if (frame.type === "session_renamed" || frame.type === "compaction_done" || frame.type === "done") {
        void refresh();
      }
    });
    return off;
  }, [onFrame, sessionId, refresh]);

  const commit = useCallback(async (message: string): Promise<string | null> => {
    setBusy(true);
    try {
      const res = await apiFetch(`/sessions/${sessionId}/git/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return body.error === "nothing_to_commit" ? "nothing to commit" : body.error === "not_a_git_repo" ? "not a git repo" : "commit failed";
      }
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }, [sessionId, refresh]);

  const createCheckpoint = useCallback(async (label: string) => {
    setBusy(true);
    try {
      await apiFetch(`/sessions/${sessionId}/checkpoints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(label ? { label } : {}),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [sessionId, refresh]);

  const restoreCheckpoint = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/checkpoints/${id}/restore`, { method: "POST" });
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteCheckpoint = useCallback(async (id: string) => {
    await apiFetch(`/checkpoints/${id}`, { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { git, children, checkpoints, plan, jobs, busy, refresh, commit, createCheckpoint, restoreCheckpoint, deleteCheckpoint };
}

/** Load/save session files (editor tab). */
export function useSessionFiles(sessionId: string) {
  const [files, setFiles] = useState<string[]>([]);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const list = useCallback(async () => {
    try {
      const res = await apiFetch(`/sessions/${sessionId}/files`);
      if (res.ok) setFiles(((await res.json()) as { files: string[] }).files);
    } catch {
      // offline
    }
  }, [sessionId]);

  useEffect(() => {
    setFiles([]);
    setOpenPath(null);
    void list();
  }, [list]);

  const open = useCallback(async (path: string) => {
    const res = await apiFetch(`/sessions/${sessionId}/files/${encodeURI(path)}`);
    if (!res.ok) return;
    const body = (await res.json()) as { content: string };
    setOpenPath(path);
    setContent(body.content);
    setDirty(false);
  }, [sessionId]);

  const save = useCallback(async () => {
    if (!openPath) return;
    await apiFetch(`/sessions/${sessionId}/files/${encodeURI(openPath)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setDirty(false);
  }, [sessionId, openPath, content]);

  return { files, openPath, content, dirty, setContent: (c: string) => { setContent(c); setDirty(true); }, open, save, reload: list };
}

/** One-shot console (terminal tab): history of command/output pairs. */
export function useSessionConsole(sessionId: string) {
  const [history, setHistory] = useState<Array<{ command: string; stdout: string; stderr: string; exitCode: number | null }>>([]);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (command: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/sessions/${sessionId}/console`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const body = (await res.json()) as { stdout?: string; stderr?: string; exitCode?: number | null };
      setHistory((prev) => [...prev, { command, stdout: body.stdout ?? "", stderr: body.stderr ?? "", exitCode: body.exitCode ?? null }]);
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  return { history, busy, run };
}

export type { SessionDetail };
