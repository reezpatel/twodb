import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  chatApi,
  dmTitle,
  type Channel,
  type Member,
  type Message,
  type Notification,
} from "./chat-client";
import { useChatSocketRef, type ServerFrame } from "./chat-socket";

/**
 * App-level chat state: channels, live messages per channel, notifications,
 * presence, typing. One WS subscription feeds everything; components read
 * from context instead of owning sockets.
 */

interface ChatState {
  status: "connecting" | "open" | "closed";
  myUserId: string | null;
  myUserName: string;
  channels: Channel[];
  channelsLoading: boolean;
  messagesByChannel: Record<string, Message[]>;
  notifications: Notification[];
  unreadNotifications: number;
  online: Set<string>;
  typingByChannel: Record<string, { actorId: string; name: string; at: number }[]>;
  activeChannelId: string | null;
  setActiveChannel: (id: string | null) => void;
  refreshChannels: () => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  loadMore: (channelId: string) => Promise<string | null>;
  send: (channelId: string, input: { text?: string; blocks?: unknown[]; replyToId?: string }) => Promise<void>;
  sendTyping: (channelId: string) => void;
  react: (message: Message, emoji: string) => Promise<void>;
  pin: (message: Message) => Promise<void>;
  save: (message: Message) => Promise<void>;
  remove: (message: Message) => Promise<void>;
  createChannel: (name: string, topic?: string) => Promise<void>;
  openDm: (userIds: string[], botIds: string[]) => Promise<Channel | null>;
  joinChannel: (channelId: string) => Promise<void>;
  markChannelRead: (channelId: string, messageId: string | null) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  channelTitle: (channel: Channel) => string;
  memberName: (member: Pick<Member, "type" | "userId" | "botId" | "name">) => string;
  members: Member[];
}

const ChatContext = createContext<ChatState | null>(null);

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}

export function ChatProvider(props: { myUserId: string | null; myUserName: string; children: ReactNode }) {
  const { myUserId, myUserName } = props;

  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, Message[]>>({});
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typingByChannel, setTypingByChannel] = useState<Record<string, { actorId: string; name: string; at: number }[]>>({});
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  // The client overlay for user display names: server knows ids, the session
  // knows this user's name. Other members show their fallback name until the
  // control-plane directory endpoint exists (repo remembers forwarded names).
  const nameOverlay = useRef(new Map<string, string>());
  if (myUserId && myUserName) nameOverlay.current.set(myUserId, myUserName);

  const displayMessage = useCallback(
    (message: Message): Message =>
      message.userId === myUserId && myUserName ? { ...message, authorName: myUserName } : message,
    [myUserId, myUserName],
  );

  const displayChannel = useCallback(
    (channel: Channel): Channel => ({
      ...channel,
      members: channel.members.map((member) =>
        member.type === "user" && member.userId === myUserId && myUserName ? { ...member, name: myUserName } : member,
      ),
    }),
    [myUserId, myUserName],
  );

  const applyFrame = useCallback(
    (frame: ServerFrame) => {
      switch (frame.type) {
        case "presence":
          setOnline(new Set(frame.online.map((o) => o.id)));
          return;
        case "message": {
          const incoming = displayMessage(frame.message);
          setMessagesByChannel((prev) => {
            const existing = prev[frame.channelId] ?? [];
            if (existing.some((m) => m.id === incoming.id)) return prev;
            return { ...prev, [frame.channelId]: [...existing, incoming] };
          });
          // clear typing indicator for the author
          setTypingByChannel((prev) => {
            const list = prev[frame.channelId];
            if (!list?.length) return prev;
            return { ...prev, [frame.channelId]: list };
          });
          // unread badge for non-active channels
          if (frame.channelId !== activeChannelIdRef.current) {
            setChannels((prev) =>
              prev.map((ch) => (ch.id === frame.channelId && frame.message.userId !== myUserId ? { ...ch, unreadCount: ch.unreadCount + 1 } : ch)),
            );
          }
          return;
        }
        case "message_edited": {
          const incoming = displayMessage(frame.message);
          setMessagesByChannel((prev) => {
            const list = prev[frame.channelId];
            if (!list) return prev;
            return {
              ...prev,
              [frame.channelId]: list.map((m) =>
                m.id === incoming.id ? { ...incoming, saved: m.saved, reactions: m.reactions } : m,
              ),
            };
          });
          return;
        }
        case "message_deleted": {
          setMessagesByChannel((prev) => {
            const list = prev[frame.channelId];
            if (!list) return prev;
            return {
              ...prev,
              [frame.channelId]: list.map((m) => (m.id === frame.messageId ? { ...m, deletedAt: new Date().toISOString(), text: "", blocks: null } : m)),
            };
          });
          return;
        }
        case "reaction": {
          setMessagesByChannel((prev) => {
            const list = prev[frame.channelId];
            if (!list) return prev;
            return {
              ...prev,
              [frame.channelId]: list.map((m) => (m.id === frame.messageId ? { ...m, reactions: frame.reactions } : m)),
            };
          });
          return;
        }
        case "pin": {
          setMessagesByChannel((prev) => {
            const list = prev[frame.channelId];
            if (!list) return prev;
            return { ...prev, [frame.channelId]: list.map((m) => (m.id === frame.messageId ? { ...m, pinned: frame.pinned } : m)) };
          });
          return;
        }
        case "typing": {
          if (frame.actor.id === myUserId) return;
          setTypingByChannel((prev) => {
            const list = (prev[frame.channelId] ?? []).filter((t) => t.actorId !== frame.actor.id);
            return { ...prev, [frame.channelId]: [...list, { actorId: frame.actor.id, name: frame.actor.name, at: Date.now() }] };
          });
          return;
        }
        case "notification": {
          setNotifications((prev) => [frame.notification, ...prev].slice(0, 100));
          setUnreadNotifications((n) => n + 1);
          return;
        }
        case "channel_created":
        case "channel_updated":
        case "channel_deleted":
          void refreshChannelsRef.current?.();
          return;
        default:
          return;
      }
    },
    [myUserId, displayMessage],
  );

  const activeChannelIdRef = useRef<string | null>(null);
  activeChannelIdRef.current = activeChannelId;
  const refreshChannelsRef = useRef<(() => Promise<void>) | null>(null);

  const send = useChatSocketRef(!!myUserId, {
    onFrame: applyFrame,
    onStatus: setStatus,
  });

  // Expire typing indicators after 4s.
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - 4000;
      setTypingByChannel((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [ch, list] of Object.entries(prev)) {
          const fresh = list.filter((t2) => t2.at > cutoff);
          if (fresh.length !== list.length) changed = true;
          next[ch] = fresh;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const refreshChannels = useCallback(async () => {
    try {
      const list = await chatApi.listChannels();
      setChannels(list.map(displayChannel));
    } finally {
      setChannelsLoading(false);
    }
  }, [displayChannel]);
  refreshChannelsRef.current = refreshChannels;

  useEffect(() => {
    if (!myUserId) return;
    void refreshChannels();
    void chatApi
      .listNotifications()
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadNotifications(res.unread);
      })
      .catch(() => {});
  }, [myUserId, refreshChannels]);

  const loadMessages = useCallback(async (channelId: string) => {
    const res = await chatApi.listMessages(channelId, null);
    setMessagesByChannel((prev) => ({ ...prev, [channelId]: res.messages.map(displayMessage) }));
    setCursors((prev) => ({ ...prev, [channelId]: res.next }));
  }, [displayMessage]);

  const loadMore = useCallback(
    async (channelId: string) => {
      const cursor = cursors[channelId];
      if (!cursor) return null;
      const res = await chatApi.listMessages(channelId, cursor);
      setMessagesByChannel((prev) => ({ ...prev, [channelId]: [...res.messages.map(displayMessage), ...(prev[channelId] ?? [])] }));
      setCursors((prev) => ({ ...prev, [channelId]: res.next }));
      return res.next;
    },
    [cursors, displayMessage],
  );

  const sendTyping = useCallback(
    (channelId: string) => {
      send({ type: "typing", channelId });
    },
    [send],
  );

  const post = useCallback(
    async (channelId: string, input: { text?: string; blocks?: unknown[]; replyToId?: string }) => {
      const message = displayMessage(await chatApi.postMessage(channelId, input as { text?: string }));
      setMessagesByChannel((prev) => {
        const existing = prev[channelId] ?? [];
        if (existing.some((m) => m.id === message.id)) return prev;
        return { ...prev, [channelId]: [...existing, message] };
      });
    },
    [displayMessage],
  );

  const react = useCallback(async (message: Message, emoji: string) => {
    const res = await chatApi.toggleReaction(message.id, emoji);
    setMessagesByChannel((prev) => {
      const list = prev[message.channelId];
      if (!list) return prev;
      return { ...prev, [message.channelId]: list.map((m) => (m.id === message.id ? { ...m, reactions: res.reactions } : m)) };
    });
  }, []);

  const pin = useCallback(async (message: Message) => {
    const res = await chatApi.togglePin(message.id);
    setMessagesByChannel((prev) => {
      const list = prev[message.channelId];
      if (!list) return prev;
      return { ...prev, [message.channelId]: list.map((m) => (m.id === message.id ? { ...m, pinned: res.pinned } : m)) };
    });
  }, []);

  const save = useCallback(async (message: Message) => {
    await chatApi.toggleSaved(message.id);
    setMessagesByChannel((prev) => {
      const list = prev[message.channelId];
      if (!list) return prev;
      return { ...prev, [message.channelId]: list.map((m) => (m.id === message.id ? { ...m, saved: !m.saved } : m)) };
    });
  }, []);

  const remove = useCallback(async (message: Message) => {
    await chatApi.deleteMessage(message.id);
    setMessagesByChannel((prev) => {
      const list = prev[message.channelId];
      if (!list) return prev;
      return { ...prev, [message.channelId]: list.filter((m) => m.id !== message.id) };
    });
  }, []);

  const createChannel = useCallback(
    async (name: string, topic?: string) => {
      await chatApi.createChannel({ name, topic });
      await refreshChannels();
    },
    [refreshChannels],
  );

  const openDm = useCallback(
    async (userIds: string[], botIds: string[]) => {
      const channel = await chatApi.openDm({ userIds, botIds });
      await refreshChannels();
      return channel;
    },
    [refreshChannels],
  );

  const joinChannel = useCallback(
    async (channelId: string) => {
      await chatApi.joinChannel(channelId);
      await refreshChannels();
    },
    [refreshChannels],
  );

  const markChannelRead = useCallback(
    async (channelId: string, messageId: string | null) => {
      send({ type: "read", channelId, messageId });
      setChannels((prev) => prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0 } : ch)));
    },
    [send],
  );

  const markNotificationRead = useCallback(async (id: string) => {
    await chatApi.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadNotifications((n) => Math.max(0, n - 1));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await chatApi.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadNotifications(0);
  }, []);

  const setActiveChannel = useCallback((id: string | null) => {
    setActiveChannelId(id);
  }, []);

  const members = useMemo(() => {
    const byId = new Map<string, Member>();
    for (const ch of channels) for (const m of ch.members) {
      const key = m.type === "user" ? m.userId : m.botId;
      if (key) byId.set(`${m.type}:${key}`, m);
    }
    return [...byId.values()];
  }, [channels]);

  const channelTitle = useCallback(
    (channel: Channel) => dmTitle(channel, myUserId),
    [myUserId],
  );

  const memberName = useCallback(
    (member: Pick<Member, "type" | "userId" | "botId" | "name">) => {
      if (member.type === "user" && member.userId) {
        const overlay = nameOverlay.current.get(member.userId);
        if (overlay) return overlay;
      }
      return member.name;
    },
    [],
  );

  const value: ChatState = {
    status,
    myUserId,
    myUserName,
    channels,
    channelsLoading,
    messagesByChannel,
    notifications,
    unreadNotifications,
    online,
    typingByChannel,
    activeChannelId,
    setActiveChannel,
    refreshChannels,
    loadMessages,
    loadMore,
    send: post,
    sendTyping,
    react,
    pin,
    save,
    remove,
    createChannel,
    openDm,
    joinChannel,
    markChannelRead,
    markNotificationRead,
    markAllNotificationsRead,
    channelTitle,
    memberName,
    members,
  };

  return <ChatContext.Provider value={value}>{props.children}</ChatContext.Provider>;
}
