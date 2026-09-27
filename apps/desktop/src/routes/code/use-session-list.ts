import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface CodeSession {
  id: string;
  title: string;
  connectionId: string | null;
  model: string | null;
  codeDirectoryId: string | null;
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

export function useSessionList(onCreated: (id: string) => void) {
  const queryClient = useQueryClient();

  const sessions = useQuery({
    queryKey: ["code", "sessions"],
    queryFn: () => api<CodeSession[]>("/api/code/sessions"),
  });

  const create = useMutation({
    mutationFn: () => api<CodeSession>("/api/code/sessions", { method: "POST", body: "{}" }),
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
