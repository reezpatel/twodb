import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface AssistantThread {
  id: string;
  title: string;
  connectionId: string | null;
  model: string | null;
  thinkingLevel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantArtifact {
  id: string;
  title: string;
  type: "markdown" | "html" | "code" | "text";
  content: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface AssistantThreadDetail extends AssistantThread {
  messages: AssistantMessage[];
  artifacts: AssistantArtifact[];
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number; contextTokens: number };
}

/** Selected thread lives in the URL (/apps/assistant/:threadId) so refresh restores it. */
export function useAssistantScene() {
  const queryClient = useQueryClient();
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const selectedId = threadId ?? null;

  const threads = useQuery({
    queryKey: ["assistant", "threads"],
    queryFn: () => api<AssistantThread[]>("/api/assistant/threads"),
  });

  const thread = useQuery({
    queryKey: ["assistant", "thread", selectedId],
    queryFn: () => api<AssistantThreadDetail>(`/api/assistant/threads/${selectedId}`),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: () => api<AssistantThread>("/api/assistant/threads", { method: "POST", body: "{}" }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
      navigate(`/apps/assistant/${row.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/assistant/threads/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["assistant", "threads"] });
      if (selectedId === id) navigate("/apps/assistant");
    },
  });

  return { threads, thread, selectedId, setSelectedId: (id: string) => navigate(`/apps/assistant/${id}`), create, remove };
}
