import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { emailKeys, type ThreadDetail } from "../email-api";

/** Thread detail + per-message actions; marks the thread read on open and decides which messages start expanded. */
export function useThreadReader(threadId: string | null, onEditDraft: (id: string) => void) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: emailKeys.thread(threadId ?? ""),
    queryFn: () => api<ThreadDetail>(`/api/email/threads/${threadId}`),
    enabled: !!threadId,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const markedRef = useRef<string | null>(null);

  const refresh = () => {
    if (threadId) void queryClient.invalidateQueries({ queryKey: emailKeys.thread(threadId) });
    void queryClient.invalidateQueries({ queryKey: emailKeys.threads });
    void queryClient.invalidateQueries({ queryKey: ["email", "counts"] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api("/api/email/threads/bulk", { method: "POST", body: JSON.stringify({ ids: [id], action: "read" }) }),
    onSuccess: refresh,
  });

  useEffect(() => {
    const data = detail.data;
    if (!data || markedRef.current === data.thread.id) return;
    markedRef.current = data.thread.id;
    const live = data.messages.filter((m) => m.status !== "draft");
    const open = new Set(live.filter((m) => !m.isRead).map((m) => m.id));
    const last = live.at(-1);
    if (last) open.add(last.id);
    setExpanded(open);
    if (data.thread.unreadCount > 0 && data.role !== "viewer") markRead.mutate(data.thread.id);
  }, [detail.data, markRead]);

  const messageOp = useMutation({
    mutationFn: async ({ id, op, body }: { id: string; op: "star" | "unstar" | "delete" | "restore" | "purge" | "retry" | "edit" | "discard" | "unread"; body?: unknown }) => {
      switch (op) {
        case "star":
        case "unstar":
          return api(`/api/email/messages/${id}`, { method: "PATCH", body: JSON.stringify({ isStarred: op === "star" }) });
        case "unread":
          return api(`/api/email/messages/${id}`, { method: "PATCH", body: JSON.stringify({ isRead: false }) });
        case "delete":
          return api(`/api/email/messages/${id}`, { method: "DELETE" });
        case "restore":
          return api(`/api/email/messages/${id}/restore`, { method: "POST", body: "{}" });
        case "purge":
          return api(`/api/email/messages/${id}/purge`, { method: "POST", body: "{}" });
        case "retry":
          return api(`/api/email/messages/${id}/retry`, { method: "POST", body: "{}" });
        case "edit":
          return api(`/api/email/messages/${id}/cancel`, { method: "POST", body: JSON.stringify(body ?? {}) });
        case "discard":
          return api(`/api/email/drafts/${id}`, { method: "DELETE" });
      }
    },
    onSuccess: (_d, { id, op }) => {
      refresh();
      if (op === "edit") {
        void queryClient.invalidateQueries({ queryKey: emailKeys.draft(id) });
        onEditDraft(id);
      }
    },
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const messages = detail.data?.messages ?? [];
  const lastLive = useMemo(() => [...messages].reverse().find((m) => m.status !== "draft" && !m.deletedAt) ?? null, [messages]);

  return { detail, expanded, toggle, messageOp, lastLive };
}
