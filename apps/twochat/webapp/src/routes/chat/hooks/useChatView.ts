import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat } from "../../../lib/chat-context";
import { chatApi, controlPlaneClient, type Asset, type Channel, type ConversationList, type Message, type Space } from "../../../lib/chat-client";

/** Holding hook for native and imported conversations organized by list group. */
export function useChatView() {
  const chat = useChat();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newChannelError, setNewChannelError] = useState<string | null>(null);
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [startDmError, setStartDmError] = useState<string | null>(null);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [lists, setLists] = useState<ConversationList[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [conversationsByList, setConversationsByList] = useState<Record<string, Channel[]>>({});
  const [addListOpen, setAddListOpen] = useState(false);
  const [addListError, setAddListError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refreshLists = useCallback(async () => {
    const result = await chatApi.listLists();
    setLists(result);
    setActiveListId((current) => current && result.some((list) => list.id === current) ? current : result.find((list) => list.isDefault)?.id ?? result[0]?.id ?? null);
    return result;
  }, []);

  useEffect(() => {
    void Promise.all([
      refreshLists().catch(() => [] as ConversationList[]),
      controlPlaneClient.listSpaces().catch(() => ({ spaces: [] as Space[] })),
    ]).then(([, result]) => setSpaces(result.spaces));
  }, [refreshLists]);

  const activeList = lists.find((list) => list.id === activeListId) ?? null;
  const activeConversations = activeListId ? (conversationsByList[activeListId] ?? []) : [];

  useEffect(() => {
    if (!activeListId) return;
    void chatApi.listListConversations(activeListId).then((items) => {
      setConversationsByList((current) => ({ ...current, [activeListId]: items }));
      const selectedStillExists = chat.activeChannelId && items.some((conversation) => conversation.id === chat.activeChannelId);
      if (!selectedStillExists) chat.setActiveChannel(items.find((conversation) => conversation.name === "general")?.id ?? items[0]?.id ?? null);
    }).catch(() => setConversationsByList((current) => ({ ...current, [activeListId]: [] })));
  }, [activeListId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeChannel = useMemo(
    () => activeConversations.find((conversation) => conversation.id === chat.activeChannelId) ?? null,
    [activeConversations, chat.activeChannelId],
  );
  const messages = chat.activeChannelId ? (chat.messagesByChannel[chat.activeChannelId] ?? []) : [];

  useEffect(() => {
    if (!activeChannel) return;
    setReplyTo(null);
    void chat.loadMessages(activeChannel.id).then(() => {
      const last = chat.messagesByChannel[activeChannel.id]?.at(-1);
      void chat.markChannelRead(activeChannel.id, last?.id ?? null);
    });
    if (!activeChannel.isReadOnly) {
      chatApi.getDraft(activeChannel.id).then((draft) => setDrafts((current) => ({ ...current, [activeChannel.id]: draft.text }))).catch(() => {});
    }
  }, [activeChannel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastMessageId = messages.at(-1)?.id ?? null;
  useEffect(() => {
    if (activeChannel && lastMessageId && activeChannel.unreadCount > 0) void chat.markChannelRead(activeChannel.id, lastMessageId);
  }, [lastMessageId, activeChannel?.unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const sidebarPreviews = useMemo(() => {
    const previews: Record<string, string> = {};
    for (const conversation of activeConversations) {
      const latest = chat.messagesByChannel[conversation.id]?.at(-1);
      if (latest) {
        const prefix = latest.userId === chat.myUserId ? "You: " : latest.authorName ? `${latest.authorName}: ` : "";
        previews[conversation.id] = `${prefix}${latest.text || "Shared an attachment"}`;
      } else previews[conversation.id] = conversation.topic || (conversation.isReadOnly ? "Read-only local copy" : "Start a conversation");
    }
    return previews;
  }, [activeConversations, chat.messagesByChannel, chat.myUserId]);

  const onSend = useCallback(async (input: { text?: string; blocks?: unknown[]; replyToId?: string }) => {
    if (!activeChannel || activeChannel.isReadOnly) return;
    await chat.send(activeChannel.id, input);
    setReplyTo(null);
  }, [activeChannel, chat]);

  const onUpload = useCallback(async (files: File[]): Promise<Asset[]> => {
    if (!activeChannel || activeChannel.isReadOnly) return [];
    return chatApi.uploadAssets(activeChannel.id, files);
  }, [activeChannel]);

  const onDraftChange = useCallback((text: string) => {
    if (!activeChannel || activeChannel.isReadOnly) return;
    setDrafts((current) => ({ ...current, [activeChannel.id]: text }));
    void chatApi.saveDraft(activeChannel.id, text).catch(() => {});
  }, [activeChannel]);

  const refreshActiveList = useCallback(async () => {
    if (!activeListId) return;
    const items = await chatApi.listListConversations(activeListId);
    setConversationsByList((current) => ({ ...current, [activeListId]: items }));
    await refreshLists();
  }, [activeListId, refreshLists]);

  const onCreateChannel = useCallback(async (name: string, topic: string) => {
    if (!activeListId) return;
    setNewChannelError(null);
    try {
      await chatApi.createListConversation(activeListId, { name, topic: topic || undefined });
      await refreshActiveList();
      setNewChannelOpen(false);
    } catch (err) {
      setNewChannelError((err as Error).message);
    }
  }, [activeListId, refreshActiveList]);

  const onStartDm = useCallback(async (participantId: string, kind: "user" | "bot") => {
    if (!activeListId) return;
    setStartDmError(null);
    try {
      const channel = await chatApi.openDm({ listId: activeListId, userIds: kind === "user" ? [participantId] : [], botIds: kind === "bot" ? [participantId] : [] });
      await refreshActiveList();
      setStartDmOpen(false);
      chat.setActiveChannel(channel.id);
    } catch (err) {
      setStartDmError((err as Error).message);
    }
  }, [activeListId, chat, refreshActiveList]);

  const onCreateList = useCallback(async (name: string, spaceId?: string | null) => {
    setAddListError(null);
    try {
      const list = await chatApi.createList({ name, spaceId });
      setLists((current) => [...current, list]);
      setActiveListId(list.id);
      setAddListOpen(false);
    } catch (err) {
      setAddListError((err as Error).message);
    }
  }, []);

  const typingNames = useMemo(() => {
    if (!chat.activeChannelId) return [];
    return (chat.typingByChannel[chat.activeChannelId] ?? []).map((item) => item.actorId === chat.myUserId ? null : item.name).filter((name): name is string => !!name);
  }, [chat.typingByChannel, chat.activeChannelId, chat.myUserId]);

  // A collaborator working in the active channel (bot id → its name from the member list).
  const workingBotId = chat.activeChannelId ? chat.collabWorking[chat.activeChannelId] : undefined;
  const working = useMemo(() => {
    if (!workingBotId || !activeChannel) return null;
    const bot = activeChannel.members.find((member) => member.botId === workingBotId);
    return { name: bot?.name ?? "The collaborator", onStop: () => void chatApi.stopCollab(activeChannel.id).catch(() => {}) };
  }, [workingBotId, activeChannel]);

  /** Rolling back only makes sense in a conversation a collaborator has replied in. */
  const hasCollaborator = messages.some((message) => !!message.collab);
  const onRollback = useCallback(async (message: Message, restoreFiles: boolean) => {
    if (!activeChannel) return;
    await chatApi.rollbackTo(message.id, restoreFiles);
    await chat.loadMessages(activeChannel.id);
    // Edit and resend: the rolled-back text comes back as the draft.
    if (message.text) onDraftChange(message.text);
  }, [activeChannel, chat, onDraftChange]);

  const isMember = !!(activeChannel && chat.myUserId && activeChannel.members.some((member) => member.userId === chat.myUserId));
  const resolveMention = useCallback((kind: string, id: string) => {
    const hit = chat.members.find((member) => kind === "user" ? member.userId === id : member.botId === id);
    return hit ? chat.memberName(hit) : null;
  }, [chat.members, chat]);

  return {
    chat,
    lists,
    spaces,
    activeList,
    activeListId,
    setActiveListId: (id: string) => { setActiveListId(id); setSidebarSearch(""); },
    activeConversations,
    activeChannel,
    messages,
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
    addListOpen,
    setAddListOpen,
    addListError,
    onCreateList,
    notifsOpen,
    setNotifsOpen,
    sidebarSearch,
    setSidebarSearch,
    sidebarPreviews,
    drafts,
    onSend,
    onUpload,
    onDraftChange,
    typingNames,
    working,
    onRollback: hasCollaborator ? onRollback : undefined,
    isMember,
    resolveMention,
  };
}
