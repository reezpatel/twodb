import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AtSign, Bookmark, FileText, Plus, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/side-nav";
import { cn } from "@/lib/utils";
import type { ChatAttachment, ChatChannel, ChatMessage } from "./use-chat";
import {
  useChannelDetail,
  useChannelFiles,
  useChannelPins,
  useChannels,
  useChatActions,
  useChatSocket,
  useCollaborators,
  useDrafts,
  useInbox,
  useMessages,
} from "./use-chat";

/** Chat scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. */
export interface ChatSceneState {
  channels: ReturnType<typeof useChannels>;
  collaborators: ReturnType<typeof useCollaborators>;
  drafts: ReturnType<typeof useDrafts>;
  inbox: ReturnType<typeof useInbox>;
  messages: ReturnType<typeof useMessages>;
  detail: ReturnType<typeof useChannelDetail>;
  files: ReturnType<typeof useChannelFiles>;
  pins: ReturnType<typeof useChannelPins>;
  agentStates: ReturnType<typeof useChatSocket>;
  actions: ReturnType<typeof useChatActions>;
  channelId: string | null;
  setChannelId: (id: string) => void;
  creating: boolean;
  setCreating: (open: boolean) => void;
  replyTo: ChatMessage | null;
  setReplyTo: (m: ChatMessage | null) => void;
  createAssistant: () => Promise<void>;
}

const ChatContext = createContext<ChatSceneState | null>(null);

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function ChatProvider({ children }: { children: ReactNode }) {
  const channels = useChannels();
  const collaborators = useCollaborators();
  const drafts = useDrafts();
  const inbox = useInbox();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = channels.data ?? [];

  // Pick a default channel once loaded.
  useEffect(() => {
    if (channelId === null && list.length > 0) setChannelId(list[0].id);
  }, [channelId, list]);

  const messages = useMessages(channelId);
  const detail = useChannelDetail(channelId);
  const files = useChannelFiles(channelId);
  const pins = useChannelPins(channelId);
  const agentStates = useChatSocket(channelId);
  const actions = useChatActions(channelId);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const createAssistant = async () => {
    const sentinel = (collaborators.data ?? []).find((c) => c.type === "sentinel");
    if (!sentinel || !sentinel.available) return;
    const created = await actions.createChannel.mutateAsync({ name: "Assistant", kind: "assistant", memberAgentIds: [sentinel.id] }).catch(() => null);
    if (created) setChannelId(created.id);
  };

  const value = useMemo(
    () =>
      ({
        channels,
        collaborators,
        drafts,
        inbox,
        messages,
        detail,
        files,
        pins,
        agentStates,
        actions,
        channelId,
        setChannelId,
        creating,
        setCreating,
        replyTo,
        setReplyTo,
        createAssistant,
      }) satisfies ChatSceneState,
    [channels, collaborators, drafts, inbox, messages, detail, files, pins, agentStates, actions, channelId, creating, replyTo, createAssistant],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatScene() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatScene must be used within ChatProvider");
  return ctx;
}

/** The chat sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function ChatSidenav() {
  const s = useChatScene();
  const { channels, collaborators, drafts, inbox, channelId, setChannelId, setCreating, createAssistant } = s;
  const list = channels.data ?? [];
  const rows = s.messages.data?.messages ?? [];

  const inboxCount = (inbox.data ?? []).length;
  const draftCount = (drafts.data ?? []).filter((d) => d.body.trim()).length;
  const savedCount = rows.filter((r) => r.saved).length;

  const visibleChannels = list.filter((ch) => ch.kind === "channel");
  const assistantChannel = list.find((ch) => ch.kind === "assistant");
  const depthOf = (ch: ChatChannel, guard = 0): number => {
    if (!ch.parentId || guard > 8) return 0;
    const parent = list.find((p) => p.id === ch.parentId);
    return parent ? depthOf(parent, guard + 1) + 1 : 0;
  };

  return (
    <SideNav>
      <div className="flex items-center justify-between px-1">
        <strong className="text-base font-semibold">Chat</strong>
        <Button variant="ghost" size="icon-xs" aria-label="Add channel" onClick={() => setCreating(true)}>
          <Plus size={13} />
        </Button>
      </div>
      <nav className="flex flex-col gap-0.5">
        {assistantChannel ? (
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              assistantChannel.id === channelId ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent/50",
            )}
            onClick={() => setChannelId(assistantChannel.id)}
          >
            <Sparkles size={15} className="shrink-0 opacity-70" />
            Assistant
            {assistantChannel.unread ? <b className="ml-auto text-xs font-medium tabular-nums">{assistantChannel.unread}</b> : null}
          </button>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            onClick={() => void createAssistant()}
          >
            <Sparkles size={15} className="shrink-0 opacity-70" />
            Assistant
            <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">
              New
            </Badge>
          </button>
        )}
        {[
          { icon: FileText, label: "Drafts", count: draftCount },
          { icon: Bookmark, label: "Saved items", count: savedCount },
          { icon: AtSign, label: "Inbox", count: inboxCount },
        ].map((q) => {
          const Icon = q.icon;
          return (
            <span key={q.label} className="text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <Icon size={15} className="shrink-0 opacity-70" />
              {q.label}
              {q.count ? <b className="ml-auto text-xs font-medium tabular-nums">{q.count}</b> : null}
            </span>
          );
        })}
      </nav>
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-muted-foreground/70 px-2 text-[11px] font-semibold tracking-wider uppercase">Collaborators</span>
      </div>
      <nav className="flex flex-col gap-px">
        {(collaborators.data ?? [])
          .filter((c) => c.type === "collaborator")
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
              title={c.available ? `${c.provider} · ${c.model}` : "no enabled connection"}
              onClick={() => {
                const existing = visibleChannels.find((ch) => (s.detail.data?.members ?? []).some((m) => m.agentId === c.id) && ch.id === channelId);
                if (existing) setChannelId(existing.id);
              }}
            >
              <span className="relative shrink-0">
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(c.name)}</AvatarFallback>
                </Avatar>
                {c.active ? <i className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" /> : null}
              </span>
              <span className={cn("truncate", !c.available && "text-muted-foreground/50")}>{c.name}</span>
            </button>
          ))}
        {(collaborators.data ?? []).filter((c) => c.type === "collaborator").length === 0 ? (
          <span className="text-muted-foreground/60 px-2 py-1 text-xs">None yet — add agents in Settings</span>
        ) : null}
      </nav>
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-muted-foreground/70 px-2 text-[11px] font-semibold tracking-wider uppercase">Channels</span>
        <Button variant="ghost" size="icon-xs" aria-label="Add channel" onClick={() => setCreating(true)}>
          <Plus size={13} />
        </Button>
      </div>
      <nav className="-mr-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pr-1">
        {visibleChannels.map((c) => {
          const depth = depthOf(c);
          return (
            <button
              key={c.id}
              type="button"
              className={cn(
                "hover:bg-accent/50 flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
                c.id === channelId ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground",
              )}
              style={{ paddingLeft: 8 + depth * 16 }}
              onClick={() => setChannelId(c.id)}
            >
              <span className="w-3 shrink-0 text-xs">{depth === 0 ? "#" : "↳"}</span>
              <span className="truncate">{c.name}</span>
              {c.unread ? <b className="ml-auto text-xs font-medium tabular-nums">{c.unread}</b> : null}
            </button>
          );
        })}
        {visibleChannels.length === 0 ? <span className="text-muted-foreground/60 px-2 py-1 text-xs">No channels — create one with +</span> : null}
      </nav>
    </SideNav>
  );
}

export type { ChatAttachment };
