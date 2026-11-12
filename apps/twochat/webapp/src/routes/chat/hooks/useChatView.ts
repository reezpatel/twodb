import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat } from "../../../lib/chat-context";
import { chatApi, type Asset, type Message } from "../../../lib/chat-client";

/**
 * Holding hook backing Chat.tsx: composes the shared chat context with
 * view-local state (reply target, dialog, notifications panel, drafts).
 */

export function useChatView() {
  const chat = useChat();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelError, setNewChannelError] = useState<string | null>(null);
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [startDmError, setStartDmError] = useState<string | null>(null);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const activeChannel = useMemo(
    () => chat.channels.find((c) => c.id === chat.activeChannelId) ?? null,
    [chat.channels, chat.activeChannelId],
  );
  const messages = chat.activeChannelId ? (chat.messagesByChannel[chat.activeChannelId] ?? []) : [];
  const hasMore = !!(chat.activeChannelId && null);

  // Load history when entering a channel + mark it read.
  useEffect(() => {
    if (!activeChannel) return;
    setReplyTo(null);
    void chat.loadMessages(activeChannel.id).then(() => {
      const last = chat.messagesByChannel[activeChannel.id]?.at(-1);
      void chat.markChannelRead(activeChannel.id, last?.id ?? null);
    });
    chatApi
      .getDraft(activeChannel.id)
      .then((d) => setDrafts((prev) => ({ ...prev, [activeChannel.id]: d.text })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id]);

  // Auto-mark-read while watching an active channel that receives messages.
  const lastMessageId = messages.at(-1)?.id ?? null;
  useEffect(() => {
    if (activeChannel && lastMessageId && activeChannel.unreadCount > 0) {
      void chat.markChannelRead(activeChannel.id, lastMessageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId, activeChannel?.unreadCount]);

  const onSend = useCallback(
    async (input: { text?: string; blocks?: unknown[]; replyToId?: string }) => {
      if (!activeChannel) return;
      await chat.send(activeChannel.id, input);
      setReplyTo(null);
    },
    [activeChannel, chat],
  );

  const onUpload = useCallback(
    async (files: File[]): Promise<Asset[]> => {
      if (!activeChannel) return [];
      return chatApi.uploadAssets(activeChannel.id, files);
    },
    [activeChannel],
  );

  const onDraftChange = useCallback(
    (text: string) => {
      if (!activeChannel) return;
      setDrafts((prev) => ({ ...prev, [activeChannel.id]: text }));
      void chatApi.saveDraft(activeChannel.id, text).catch(() => {});
    },
    [activeChannel],
  );

  const onCreateChannel = useCallback(
    async (name: string, topic: string) => {
      setNewChannelError(null);
      try {
        await chat.createChannel(name, topic || undefined);
        setNewChannelOpen(false);
      } catch (err) {
        setNewChannelError((err as Error).message);
      }
    },
    [chat],
  );

  const onStartDm = useCallback(
    async (participantId: string, kind: "user" | "bot") => {
      setStartDmError(null);
      try {
        const channel = await chat.openDm(kind === "user" ? [participantId] : [], kind === "bot" ? [participantId] : []);
        setStartDmOpen(false);
        if (channel) chat.setActiveChannel(channel.id);
      } catch (err) {
        setStartDmError((err as Error).message);
      }
    },
    [chat],
  );

  const typingNames = useMemo(() => {
    if (!chat.activeChannelId) return [];
    const list = chat.typingByChannel[chat.activeChannelId] ?? [];
    return list.map((t) => (t.actorId === chat.myUserId ? null : t.name)).filter((n): n is string => !!n);
  }, [chat.typingByChannel, chat.activeChannelId, chat.myUserId]);

  const isMember = !!(activeChannel && chat.myUserId && activeChannel.members.some((m) => m.userId === chat.myUserId));
  const amIAdmin = !!(activeChannel && chat.myUserId && activeChannel.members.some((m) => m.userId === chat.myUserId && m.role === "admin"));

  const resolveMention = useCallback(
    (kind: string, id: string) => {
      const hit = chat.members.find((m) => (kind === "user" ? m.userId === id : m.botId === id));
      return hit ? chat.memberName(hit) : null;
    },
    [chat.members, chat],
  );

  return {
    chat,
    activeChannel,
    messages,
    hasMore,
    replyTo,
    setReplyTo,
    newChannelOpen,
    setNewChannelOpen,
    newChannelError,
    onCreateChannel,
    startDmOpen,
    setStartDmOpen,
    startDmError,
    onStartDm,
    notifsOpen,
    setNotifsOpen,
    drafts,
    onSend,
    onUpload,
    onDraftChange,
    typingNames,
    isMember,
    amIAdmin,
    resolveMention,
  };
}
