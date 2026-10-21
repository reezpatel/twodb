import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { CodeDirectory } from "../directories/use-code-directories";
import { onOrgFrames } from "../code-room-ws";
import { api } from "@/lib/api";

export interface CodeSession {
  id: string;
  title: string;
  connectionId: string | null;
  model: string | null;
  codeDirectoryId: string | null;
  /** Bound agent (persona/collaborator/sentinel) — sessions live under their agent's sidenav tab. */
  agentId: string | null;
  thinkingLevel: string | null;
  runtimeState: Record<string, unknown> | null;
  /** Run finished since this session was last opened — sidebar unread marker. */
  unseenUpdates?: boolean;
  /** Set when archived (archive mode lists these). */
  archivedAt?: string | null;
  /** Session plan — { steps: [{ description, status }] } via update_plan. */
  plan?: { steps: { description: string; status: string }[] } | null;
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
  // Agent-bound sessions render under their agent in the agents tabs instead.
  const plain = sessions.filter((s) => !s.agentId);
  const byDirectory = new Map<string | null, CodeSession[]>();
  for (const session of plain) {
    const bucket = byDirectory.get(session.codeDirectoryId) ?? [];
    bucket.push(session);
    byDirectory.set(session.codeDirectoryId, bucket);
  }

  const groups: SessionDirectoryGroup[] = directories
    .map((dir) => ({ id: dir.id, label: dir.displayName, cwd: dir.cwd, sessions: byDirectory.get(dir.id) ?? [] }))
    .filter((group) => group.sessions.length > 0);

  const known = new Set(directories.map((dir) => dir.id));
  const unassigned = [...byDirectory.entries()].filter(([id]) => id === null || !known.has(id)).flatMap(([, items]) => items);
  // Always present — the Assistant tab is the entry point for directory-less
  // chats, even when empty (its hover + creates them).
  groups.push({ id: null, label: "Assistant", sessions: unassigned });

  return groups;
}

export interface SessionLiveState {
  running: boolean;
  needsInput: boolean;
  unseenUpdates: boolean;
}

/**
 * Org-wide sidebar channel: coarse per-session state (running / needsInput /
 * unseen) and create/update/delete notifications, riding the shared code
 * room socket (one per tab). Overlays are keyed by session id and reset
 * whenever the list refetches.
 */
export function useSessionEvents(enabled: boolean) {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<Map<string, SessionLiveState>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    return onOrgFrames((frame) => {
      if (frame.type === "session_state") {
        const f = frame as unknown as { id: string; running: boolean; needsInput: boolean; unseenUpdates: boolean };
        setLive((prev) => {
          const next = new Map(prev);
          next.set(f.id, { running: f.running, needsInput: f.needsInput, unseenUpdates: f.unseenUpdates });
          return next;
        });
      } else if (frame.type === "session_deleted") {
        const f = frame as unknown as { id: string };
        setLive((prev) => {
          const next = new Map(prev);
          next.delete(f.id);
          return next;
        });
        void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
      } else if (frame.type === "session_created" || frame.type === "session_updated") {
        // created / renamed — the REST list is the source of truth.
        void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
      }
    });
  }, [enabled, queryClient]);

  return live;
}

export function useSessionList(onCreated: (id: string) => void) {
  const queryClient = useQueryClient();
  /** Archive mode — the bottom toggle; lists archived sessions instead of active. */
  const [archiveMode, setArchiveMode] = useState(false);

  const sessions = useQuery({
    queryKey: ["code", "sessions", archiveMode],
    queryFn: () => api<CodeSession[]>(`/api/code/sessions${archiveMode ? "?archived=1" : ""}`),
  });

  // Agents for the sidenav's agent tabs (personas / collaborators / sentinel).
  // Unscoped (no directory filter) — the tabs are org-level views.
  const agents = useQuery({
    queryKey: ["code", "sidenav-agents"],
    queryFn: () => api<AgentListItem[]>("/api/agents"),
  });

  const create = useMutation({
    mutationFn: (opts: string | null | { codeDirectoryId: string | null; agentId: string }) =>
      typeof opts === "string" || opts === null
        ? api<CodeSession>("/api/code/sessions", { method: "POST", body: JSON.stringify({ codeDirectoryId: opts }) })
        : api<CodeSession>("/api/code/sessions", { method: "POST", body: JSON.stringify({ codeDirectoryId: opts.codeDirectoryId, agentId: opts.agentId }) }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
      onCreated(session.id);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/code/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] }),
  });

  /** Archive / unarchive — flips archivedAt; both list variants refetch. */
  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api(`/api/code/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ archived }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] });
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api<CodeSession>(`/api/code/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["code", "sessions"] }),
  });

  return { sessions, agents, create, remove, rename, setArchived, archiveMode, setArchiveMode };
}

/** Minimal agent shape for the sidenav tabs. */
export interface AgentListItem {
  id: string;
  name: string | null;
  description: string | null;
  provider: string;
  model: string;
  type: "sub_agent" | "persona" | "collaborator" | "sentinel";
  codeDirectoryId: string | null;
  workDirectoryId: string | null;
  updatedAt: string;
}
