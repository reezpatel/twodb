import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { CodeDirectory } from "../directories/use-code-directories";
import { api } from "@/lib/api";

export interface CodeSession {
  id: string;
  title: string;
  connectionId: string | null;
  model: string | null;
  codeDirectoryId: string | null;
  thinkingLevel: string | null;
  runtimeState: Record<string, unknown> | null;
  /** Run finished since this session was last opened — sidebar unread marker. */
  unseenUpdates?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CodeMessage {
  id: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface SessionDirectoryGroup {
  id: string | null;
  label: string;
  cwd?: string;
  sessions: CodeSession[];
}

export function groupSessionsByDirectory(sessions: CodeSession[], directories: CodeDirectory[]): SessionDirectoryGroup[] {
  const byDirectory = new Map<string | null, CodeSession[]>();
  for (const session of sessions) {
    const bucket = byDirectory.get(session.codeDirectoryId) ?? [];
    bucket.push(session);
    byDirectory.set(session.codeDirectoryId, bucket);
  }

  const groups: SessionDirectoryGroup[] = directories
    .map((dir) => ({ id: dir.id, label: dir.displayName, cwd: dir.cwd, sessions: byDirectory.get(dir.id) ?? [] }))
    .filter((group) => group.sessions.length > 0);

  const known = new Set(directories.map((dir) => dir.id));
  const unassigned = [...byDirectory.entries()].filter(([id]) => id === null || !known.has(id)).flatMap(([, items]) => items);
  // Always present — the Assistant group is the entry point for directory-less
  // chats, even when empty (its hover + creates them).
  groups.push({ id: null, label: "Assistant", sessions: unassigned });

  return groups;
}

export interface SessionLiveState {
  running: boolean;
  needsInput: boolean;
  unseenUpdates: boolean;
}

type SessionListEvent =
  | { type: "session_created"; session: { id: string; title: string; codeDirectoryId: string | null; updatedAt: string } }
  | { type: "session_updated"; session: { id: string; title: string; updatedAt: string } }
  | { type: "session_deleted"; id: string }
  | { type: "session_state"; id: string; running: boolean; needsInput: boolean; unseenUpdates: boolean };

/**
 * Org-wide sidebar channel: one socket per tab carrying coarse session state
 * (running / needsInput / unseen) and create/update/delete notifications.
 * Overlays are keyed by session id and reset whenever the list refetches.
 */
export function useSessionEvents(enabled: boolean) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<Map<string, SessionLiveState>>(new Map());
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let attempt = 0;
    const connect = () => {
      if (disposed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/api/code/sessions-ws`);
      ws.onmessage = (evt) => {
        let frame: SessionListEvent;
        try {
          frame = JSON.parse(evt.data as string) as SessionListEvent;
        } catch {
          return;
        }
        if (frame.type === "session_state") {
          setLive((prev) => {
            const next = new Map(prev);
            next.set(frame.id, { running: frame.running, needsInput: frame.needsInput, unseenUpdates: frame.unseenUpdates });
            return next;
          });
        } else if (frame.type === "session_deleted") {
          setLive((prev) => {
            const next = new Map(prev);
            next.delete(frame.id);
            return next;
          });
          void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
        } else {
          // created / renamed — the REST list is the source of truth.
          void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        attempt += 1;
        retryRef.current = setTimeout(connect, Math.min(1000 * 2 ** (attempt - 1), 15_000));
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [enabled, queryClient]);

  return live;
}

export function useSessionList(onCreated: (id: string) => void) {
  const queryClient = useQueryClient();

  const sessions = useQuery({
    queryKey: ["code", "sessions"],
    queryFn: () => api<CodeSession[]>("/api/code/sessions"),
  });

  const create = useMutation({
    mutationFn: (codeDirectoryId: string | null) => api<CodeSession>("/api/code/sessions", { method: "POST", body: JSON.stringify({ codeDirectoryId }) }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
      onCreated(session.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/code/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] }),
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api<CodeSession>(`/api/code/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] }),
  });

  return { sessions, create, remove, rename };
}
