import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  return { sessions, create, remove };
}
