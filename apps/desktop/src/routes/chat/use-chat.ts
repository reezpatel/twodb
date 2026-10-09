import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ChatChannel {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  parentId: string | null;
  kind: "channel" | "assistant" | string;
  name: string;
  description: string | null;
  position: number;
  createdById: string | null;
  lastMessageAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  unread: number;
  memberCount: number;
}

export interface ChatAttachment {
  mediaId: string;
  filename: string;
  contentType: string | null;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorType: "user" | "agent" | string;
  userId: string | null;
  agentId: string | null;
  body: string;
  meta: { mentions?: { type: string; id: string; name: string }[]; attachments?: ChatAttachment[]; linkCard?: { title: string; url: string }; sessionRef?: string } | null;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  authorName: string;
  reactions: { emoji: string; count: number; mine: boolean }[];
  pinned: boolean;
  saved: boolean;
  replyTo: { id: string; authorName: string; snippet: string } | null;
}

export interface ChatChannelMember {
  id: string;
  memberType: string;
  userId: string | null;
  agentId: string | null;
  name: string;
  role: string;
  agentType: string | null;
}

export interface ChatChannelDetail {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  creatorName: string | null;
  createdAt: string;
  messageCount: number;
  activityTotal: number;
  archivedAt: string | null;
  children: { id: string; name: string }[];
  members: ChatChannelMember[];
}

export interface ChatCollaborator {
  id: string;
  name: string;
  description: string | null;
  type: string;
  model: string;
  provider: string;
  available: boolean;
  active: boolean;
  chatChannelCount: number;
}

export interface ChatDraft {
  id: string;
  channelId: string;
  userId: string;
  body: string;
  updatedAt: string;
}

type ChatEvent =
  | { type: "message"; channelId: string; message: ChatMessage }
  | { type: "message_deleted"; channelId: string; messageId: string }
  | { type: "reaction"; channelId: string; messageId: string; reactions: ChatMessage["reactions"] }
  | { type: "agent_state"; channelId: string; agentId: string; state: "thinking" | "working" | "done" | "error"; detail?: string }
  | { type: "channel_created"; channel: ChatChannel }
  | { type: "channel_updated"; channel: ChatChannel }
  | { type: "channel_deleted"; id: string };

export interface AgentLiveState {
  agentId: string;
  state: "thinking" | "working" | "done" | "error";
  detail?: string;
}

/** Org-wide chat socket: appends messages, updates reactions, tracks agent run state. */
export function useChatSocket(activeChannelId: string | null) {
  const queryClient = useQueryClient();
  const [agentStates, setAgentStates] = useState<Map<string, AgentLiveState>>(new Map());
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    const connect = () => {
      if (disposed) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/api/chat/ws`);
      ws.onmessage = (evt) => {
        let frame: ChatEvent;
        try {
          frame = JSON.parse(evt.data as string) as ChatEvent;
        } catch {
          return;
        }
        if (frame.type === "message") {
          queryClient.setQueryData<{ messages: ChatMessage[]; next: string | null } | undefined>(["chat", "messages", frame.channelId], (prev) =>
            prev ? { ...prev, messages: [...prev.messages.filter((m) => m.id !== frame.message.id), frame.message] } : prev,
          );
          if (frame.channelId !== activeChannelId) void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
          else void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
        } else if (frame.type === "message_deleted") {
          queryClient.setQueryData<{ messages: ChatMessage[]; next: string | null } | undefined>(["chat", "messages", frame.channelId], (prev) =>
            prev ? { ...prev, messages: prev.messages.map((m) => (m.id === frame.messageId ? { ...m, deletedAt: new Date().toISOString(), body: "" } : m)) } : prev,
          );
        } else if (frame.type === "reaction") {
          queryClient.setQueryData<{ messages: ChatMessage[]; next: string | null } | undefined>(["chat", "messages", frame.channelId], (prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === frame.messageId
                      ? {
                          ...m,
                          reactions: frame.reactions.map((r) => ({ ...r, mine: r.mine })),
                        }
                      : m,
                  ),
                }
              : prev,
          );
        } else if (frame.type === "agent_state") {
          if (frame.state === "done" || frame.state === "error") {
            setAgentStates((prev) => {
              const next = new Map(prev);
              next.delete(`${frame.channelId}:${frame.agentId}`);
              return next;
            });
          } else {
            setAgentStates((prev) => {
              const next = new Map(prev);
              next.set(`${frame.channelId}:${frame.agentId}`, { agentId: frame.agentId, state: frame.state, detail: frame.detail });
              return next;
            });
          }
          void queryClient.invalidateQueries({ queryKey: ["chat", "collaborators"] });
        } else if (frame.type === "channel_deleted") {
          void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
        } else {
          void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
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
  }, [queryClient, activeChannelId]);

  return agentStates;
}

export function useChannels() {
  return useQuery({
    queryKey: ["chat", "channels"],
    queryFn: () => api<ChatChannel[]>("/api/chat/channels"),
  });
}

export function useChannelDetail(id: string | null) {
  return useQuery({
    queryKey: ["chat", "channel", id],
    queryFn: () => api<ChatChannelDetail>(`/api/chat/channels/${id}`),
    enabled: id !== null,
  });
}

export function useMessages(channelId: string | null) {
  return useQuery({
    queryKey: ["chat", "messages", channelId],
    queryFn: () => api<{ messages: ChatMessage[]; next: string | null }>(`/api/chat/channels/${channelId}/messages`),
    enabled: channelId !== null,
  });
}

export function useDrafts() {
  return useQuery({
    queryKey: ["chat", "drafts"],
    queryFn: () => api<ChatDraft[]>("/api/chat/drafts"),
  });
}

export function useInbox() {
  return useQuery({
    queryKey: ["chat", "inbox"],
    queryFn: () => api<ChatMessage[]>("/api/chat/inbox"),
  });
}

export function useCollaborators() {
  return useQuery({
    queryKey: ["chat", "collaborators"],
    queryFn: () => api<ChatCollaborator[]>("/api/chat/collaborators"),
    refetchInterval: 30_000,
  });
}

export function useChannelFiles(channelId: string | null) {
  return useQuery({
    queryKey: ["chat", "files", channelId],
    queryFn: () => api<{ id: string; filename: string; contentType: string | null; size: number; createdAt: string; previewUrl: string }[]>(`/api/chat/channels/${channelId}/files`),
    enabled: channelId !== null,
  });
}

export function useChannelPins(channelId: string | null) {
  return useQuery({
    queryKey: ["chat", "pins", channelId],
    queryFn: () => api<(ChatMessage & { pinnedAt: string })[]>(`/api/chat/channels/${channelId}/pins`),
    enabled: channelId !== null,
  });
}

export function useChatActions(channelId: string | null) {
  const queryClient = useQueryClient();
  const invalidateChannel = () => {
    if (channelId) {
      void queryClient.invalidateQueries({ queryKey: ["chat", "messages", channelId] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "channel", channelId] });
    }
  };

  const sendMessage = useMutation({
    mutationFn: (input: { body: string; replyToId?: string | null; attachments?: ChatAttachment[] }) =>
      api<{ message: ChatMessage; triggered: { agentId: string; reason: string }[] }>(`/api/chat/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidateChannel,
  });

  const react = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api(`/api/chat/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }),
    onSuccess: invalidateChannel,
  });

  const pin = useMutation({
    mutationFn: ({ messageId, pinned }: { messageId: string; pinned: boolean }) =>
      api(`/api/chat/messages/${messageId}/pin`, { method: pinned ? "DELETE" : "POST" }),
    onSuccess: invalidateChannel,
  });

  const save = useMutation({
    mutationFn: ({ messageId, saved }: { messageId: string; saved: boolean }) =>
      api(`/api/chat/messages/${messageId}/save`, { method: saved ? "DELETE" : "POST" }),
    onSuccess: invalidateChannel,
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => api(`/api/chat/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: invalidateChannel,
  });

  const markRead = useMutation({
    mutationFn: (messageId: string | null) => api(`/api/chat/channels/${channelId}/read`, { method: "PUT", body: JSON.stringify({ messageId }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] }),
  });

  const saveDraft = useMutation({
    mutationFn: (body: string) => api(`/api/chat/channels/${channelId}/draft`, { method: "PUT", body: JSON.stringify({ body }) }),
  });

  const createChannel = useMutation({
    mutationFn: (input: { name: string; parentId?: string | null; kind?: string; memberAgentIds?: string[] }) =>
      api<ChatChannel>("/api/chat/channels", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] }),
  });

  const deleteChannel = useMutation({
    mutationFn: (id: string) => api(`/api/chat/channels/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chat", "channels"] }),
  });

  const uploadAttachment = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/chat/channels/${channelId}/assets`, { method: "POST", body: form, credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `upload failed (${res.status})`);
    }
    return (await res.json()) as { id: string; filename: string; contentType: string | null; previewUrl: string };
  };

  return { sendMessage, react, pin, save, remove, markRead, saveDraft, createChannel, deleteChannel, uploadAttachment };
}
