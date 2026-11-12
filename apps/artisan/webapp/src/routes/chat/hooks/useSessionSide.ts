import { useCallback, useEffect, useState } from "react";
import type { SessionDetail } from "../../../lib/artisan-client.js";

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

export interface Checkpoint {
  id: string;
  sessionId: string;
  label: string | null;
  commitSha: string;
  trigger: string;
  createdAt: string;
}

export function useSessionSide(sessionId: string) {
  const [git, setGit] = useState<GitInfo | null>(null);
  const [children, setChildren] = useState<ChildSession[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [plan, setPlan] = useState<Array<{ description: string; status: string }> | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const base = "/artisan-api";
    const opts = { credentials: "include" as const };
    try {
      const [g, c, cp, detail] = await Promise.all([
        fetch(`${base}/sessions/${sessionId}/git`, opts).then((r) => (r.ok ? r.json() : null)),
        fetch(`${base}/sessions/${sessionId}/children`, opts).then((r) => (r.ok ? r.json() : [])),
        fetch(`${base}/sessions/${sessionId}/checkpoints`, opts).then((r) => (r.ok ? r.json() : [])),
        fetch(`${base}/sessions/${sessionId}`, opts).then((r) => (r.ok ? r.json() : null)),
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
    return () => clearInterval(t);
  }, [refresh]);

  const createCheckpoint = useCallback(async (label: string) => {
    setBusy(true);
    try {
      await fetch(`/artisan-api/sessions/${sessionId}/checkpoints`, {
        method: "POST",
        credentials: "include",
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
      await fetch(`/artisan-api/checkpoints/${id}/restore`, { method: "POST", credentials: "include" });
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteCheckpoint = useCallback(async (id: string) => {
    await fetch(`/artisan-api/checkpoints/${id}`, { method: "DELETE", credentials: "include" });
    await refresh();
  }, [refresh]);

  return { git, children, checkpoints, plan, busy, refresh, createCheckpoint, restoreCheckpoint, deleteCheckpoint };
}

/** Load/save session files (editor tab). */
export function useSessionFiles(sessionId: string) {
  const [files, setFiles] = useState<string[]>([]);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const list = useCallback(async () => {
    try {
      const res = await fetch(`/artisan-api/sessions/${sessionId}/files`, { credentials: "include" });
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
    const res = await fetch(`/artisan-api/sessions/${sessionId}/files/${encodeURI(path)}`, { credentials: "include" });
    if (!res.ok) return;
    const body = (await res.json()) as { content: string };
    setOpenPath(path);
    setContent(body.content);
    setDirty(false);
  }, [sessionId]);

  const save = useCallback(async () => {
    if (!openPath) return;
    await fetch(`/artisan-api/sessions/${sessionId}/files/${encodeURI(openPath)}`, {
      method: "PUT",
      credentials: "include",
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
      const res = await fetch(`/artisan-api/sessions/${sessionId}/console`, {
        method: "POST",
        credentials: "include",
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
