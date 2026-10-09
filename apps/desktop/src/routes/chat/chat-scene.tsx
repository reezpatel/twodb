import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Bookmark, Box, Check, FileText, Link2, Loader2, MessageSquare, Paperclip, Pin, Plus, Send, Smile, Sparkles, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChatAttachment, ChatChannel, ChatMessage } from "./use-chat";
import { useChannelDetail, useChannelFiles, useChannelPins, useChannels, useChatActions, useChatSocket, useCollaborators, useDrafts, useInbox, useMessages } from "./use-chat";

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🔥", "✅"];

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function withMentions(text: string) {
  return text.split(/(@[\w][\w.-]*)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-semibold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function when(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function AttachmentChip({ a }: { a: ChatAttachment }) {
  const image = (a.contentType ?? "").startsWith("image/");
  return (
    <a
      href={`/api/chat/assets/${a.mediaId}`}
      target="_blank"
      rel="noreferrer"
      className="bg-card hover:border-primary/40 flex max-w-60 items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors"
    >
      {image ? <img src={`/api/chat/assets/${a.mediaId}`} alt={a.filename} className="size-7 rounded object-cover" /> : <FileText size={14} className="text-muted-foreground shrink-0" />}
      <span className="truncate text-xs">{a.filename}</span>
    </a>
  );
}

function ReactionChip({ emoji, count, mine, onToggle }: { emoji: string; count: number; mine: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        "bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        mine ? "border-primary/45 bg-primary/10" : "border-border hover:border-border/80",
      )}
      onClick={onToggle}
    >
      {emoji} <b className={cn("font-semibold tabular-nums", mine ? "text-primary" : "text-muted-foreground")}>{count}</b>
    </button>
  );
}

interface PostProps {
  post: ChatMessage;
  mine: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onSave: () => void;
  onDelete: () => void;
}

function Post({ post, mine, onReply, onReact, onPin, onSave, onDelete }: PostProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (post.deletedAt) {
    return (
      <article className="text-muted-foreground/60 flex gap-3 py-3 text-xs italic">
        message deleted
      </article>
    );
  }

  return (
    <article className="group/post hover:bg-accent/20 relative flex gap-3 rounded-lg px-2 py-3">
      <Avatar>
        <AvatarFallback className={cn("text-xs", post.authorType === "agent" && "bg-primary/15 text-primary")}>{initials(post.authorName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex items-baseline gap-2">
          <strong className="text-sm font-semibold">
            {post.authorName}
            {post.authorType === "agent" ? <span className="text-primary ml-1.5 text-[10px] font-medium uppercase">AI</span> : null}
          </strong>
          <span className="text-muted-foreground text-xs tabular-nums">{when(post.createdAt)}</span>
        </header>

        {post.replyTo ? (
          <button
            type="button"
            className="bg-muted/50 hover:bg-muted flex w-fit max-w-full items-center gap-1.5 rounded-md border-l-2 border-primary/40 px-2 py-1 text-left text-xs"
            onClick={() => document.getElementById(`post-${post.replyTo!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <span className="text-muted-foreground shrink-0">↩</span>
            <span className="text-primary shrink-0 font-medium">@{post.replyTo.authorName}</span>
            <span className="text-muted-foreground truncate">{post.replyTo.snippet}</span>
          </button>
        ) : null}

        <p className="text-muted-foreground m-0 text-sm leading-relaxed">{withMentions(post.body)}</p>

        {post.meta?.attachments?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {post.meta.attachments.map((a) => (
              <AttachmentChip key={a.mediaId} a={a} />
            ))}
          </div>
        ) : null}

        {post.meta?.linkCard ? (
          <div className="bg-card flex max-w-115 items-center gap-3 rounded-lg border p-3">
            <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
              <Link2 size={14} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-sm font-semibold">{post.meta.linkCard.title}</strong>
              <span className="text-muted-foreground truncate text-xs">{post.meta.linkCard.url}</span>
            </div>
            <Button variant="secondary" size="xs" onClick={() => window.open(post.meta!.linkCard!.url, "_blank", "noopener")}>
              Open
            </Button>
          </div>
        ) : null}

        {post.reactions.length ? (
          <div className="flex gap-1.5">
            {post.reactions.map((r) => (
              <ReactionChip key={r.emoji} emoji={r.emoji} count={r.count} mine={r.mine} onToggle={() => onReact(r.emoji)} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="bg-card/95 absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border p-0.5 shadow-sm group-hover/post:flex">
        <Button variant="ghost" size="icon-sm" aria-label="Reply" onClick={onReply}>
          <MessageSquare size={13} />
        </Button>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="React">
              <Smile size={13} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-1.5">
            <div className="flex gap-0.5">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="hover:bg-accent rounded-md px-1.5 py-1 text-base transition-colors"
                  onClick={() => {
                    onReact(emoji);
                    setEmojiOpen(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon-sm" aria-label={post.pinned ? "Unpin" : "Pin"} onClick={onPin} className={post.pinned ? "text-primary" : undefined}>
          <Pin size={13} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={post.saved ? "Unsave" : "Save"} onClick={onSave} className={post.saved ? "text-primary" : undefined}>
          <Bookmark size={13} />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Copy text"
              onClick={() => {
                void navigator.clipboard.writeText(post.body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check size={13} className="text-primary" /> : <Link2 size={13} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied" : "Copy text"}</TooltipContent>
        </Tooltip>
        {mine ? (
          <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={onDelete}>
            <X size={13} />
          </Button>
        ) : null}
      </div>
      <span id={`post-${post.id}`} className="absolute -top-6" />
    </article>
  );
}

interface ComposerProps {
  members: { id: string; name: string; type: string }[];
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
  onUpload: (file: File) => Promise<ChatAttachment | null>;
  pending: boolean;
  draftBody: string | undefined;
  onDraft: (body: string) => void;
}

function Composer({ members, replyTo, onCancelReply, onSend, onUpload, pending, draftBody, onDraft }: ComposerProps) {
  const [text, setText] = useState(draftBody ?? "");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current && draftBody !== undefined) {
      hydrated.current = true;
      setText(draftBody);
    }
  }, [draftBody]);

  const atMatch = text.match(/@(\w*)$/);
  const suggestions = atMatch ? members.filter((m) => m.name.toLowerCase().replace(/\s+/g, "").includes(atMatch[1].toLowerCase())).slice(0, 4) : [];

  function insertMention(name: string) {
    setText((t) => t.replace(/@(\w*)$/, `@${name.split(" ")[0]} `));
    inputRef.current?.focus();
  }

  async function attach(file: File) {
    setUploadError(null);
    const asset = await onUpload(file);
    if (asset) setAttachments((a) => [...a, { mediaId: asset.mediaId, filename: asset.filename, contentType: asset.contentType }]);
    else setUploadError("upload failed — is the Chat Assets destination configured?");
  }

  function send() {
    if (!text.trim() || pending) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
    onDraft("");
  }

  return (
    <div className="relative border-t px-4 py-3">
      {replyTo ? (
        <div className="bg-muted/40 mb-2 flex items-center gap-2 rounded-md border-l-2 border-primary px-2.5 py-1.5 text-xs">
          <span className="text-muted-foreground">Replying to</span>
          <span className="text-primary font-medium">@{replyTo.authorName}</span>
          <span className="text-muted-foreground/70 truncate">{replyTo.body.slice(0, 60)}</span>
          <button type="button" className="text-muted-foreground hover:text-foreground ml-auto shrink-0" onClick={onCancelReply} aria-label="Cancel reply">
            <X size={13} />
          </button>
        </div>
      ) : null}
      {attachments.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.mediaId} className="bg-card flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
              <FileText size={12} className="text-muted-foreground" />
              {a.filename}
              <button type="button" aria-label={`Remove ${a.filename}`} className="text-muted-foreground hover:text-foreground" onClick={() => setAttachments((list) => list.filter((x) => x.mediaId !== a.mediaId))}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {uploadError ? <p className="text-destructive mb-2 text-xs">{uploadError}</p> : null}
      {suggestions.length ? (
        <div className="bg-popover absolute bottom-[calc(100%-4px)] left-4 z-50 flex min-w-50 flex-col gap-0.5 rounded-lg border p-2 shadow-xl">
          <span className="text-muted-foreground/70 px-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">Members</span>
          {suggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors"
              onClick={() => insertMention(m.name)}
            >
              <Avatar size="sm">
                <AvatarFallback className={cn("text-[9px]", m.type === "agent" && "bg-primary/15 text-primary")}>{initials(m.name)}</AvatarFallback>
              </Avatar>
              {m.name}
              {m.type === "agent" ? <Badge variant="secondary" className="ml-auto h-4 px-1 text-[9px]">AI</Badge> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-0.5">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = ""; }} />
        <Button variant="ghost" size="icon-sm" aria-label="Attach" onClick={() => fileRef.current?.click()}>
          <Paperclip size={15} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Mention" onClick={() => { setText((t) => `${t}@`); inputRef.current?.focus(); }}>
          <AtSign size={15} />
        </Button>
        <input
          ref={inputRef}
          className="placeholder:text-muted-foreground h-8 min-w-0 flex-1 border-none bg-transparent px-2 text-sm outline-none"
          placeholder="Write a reply… try typing @"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          aria-label="Write a reply"
        />
        <Button variant="secondary" size="sm" className="h-7 rounded-full px-4 text-xs" onClick={() => { setText(""); setAttachments([]); onDraft(""); }}>
          Discard
        </Button>
        <Button size="sm" className="h-7 rounded-full px-4.5 text-xs" onClick={send} disabled={!text.trim() || pending}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </Button>
      </div>
    </div>
  );
}

function CreateChannelDialog({ agents, onClose, onCreate }: { agents: { id: string; name: string; type: string; available: boolean }[]; onClose: () => void; onCreate: (name: string, agentIds: string[]) => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="bg-popover absolute inset-y-0 left-0 z-50 flex w-60 flex-col gap-2 border-r p-3 shadow-xl">
      <div className="flex items-center justify-between">
        <strong className="text-sm">New channel</strong>
        <Button variant="ghost" size="icon-xs" aria-label="Close" onClick={onClose}>
          <X size={13} />
        </Button>
      </div>
      <input
        className="bg-background h-8 rounded-md border px-2 text-sm outline-none"
        placeholder="Channel name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <span className="text-muted-foreground/70 text-[11px] font-semibold tracking-wider uppercase">Members</span>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={!a.available}
            className={cn("hover:bg-accent/50 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors", !a.available && "opacity-40")}
            onClick={() => setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(a.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{a.name}</span>
            {picked.includes(a.id) ? <Check size={13} className="text-primary ml-auto shrink-0" /> : null}
          </button>
        ))}
        {agents.length === 0 ? <span className="text-muted-foreground px-1.5 text-xs">No collaborator agents. Create some in Settings → Agents.</span> : null}
      </div>
      <Button size="sm" className="text-xs" disabled={!name.trim()} onClick={() => onCreate(name.trim(), picked)}>
        Create channel
      </Button>
    </div>
  );
}

const TEAM_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  collaborator: "success",
  sentinel: "warning",
  persona: "destructive",
};

export function ChatScene() {
  const channels = useChannels();
  const collaborators = useCollaborators();
  const drafts = useDrafts();
  const inbox = useInbox();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [infoTab, setInfoTab] = useState("info");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const list = channels.data ?? [];
  const active = useMemo(() => list.find((ch) => ch.id === channelId) ?? null, [list, channelId]);

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

  const me = inbox.data; // any query works to detect auth; inbox also feeds the nav count
  const draftForChannel = (drafts.data ?? []).find((d) => d.channelId === channelId);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDraft = (body: string) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => actions.saveDraft.mutate(body), 800);
  };

  const rows = messages.data?.messages ?? [];
  const lastMessage = rows[rows.length - 1];
  useEffect(() => {
    if (lastMessage) actions.markRead.mutate(lastMessage.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.id]);

  const visibleChannels = list.filter((ch) => ch.kind === "channel");
  const assistantChannel = list.find((ch) => ch.kind === "assistant");
  const depthOf = (ch: ChatChannel, guard = 0): number => {
    if (!ch.parentId || guard > 8) return 0;
    const parent = list.find((p) => p.id === ch.parentId);
    return parent ? depthOf(parent, guard + 1) + 1 : 0;
  };

  const memberOptions = (detail.data?.members ?? []).map((m) => ({ id: m.agentId ?? m.userId ?? m.id, name: m.name, type: m.memberType }));
  const activeAgents = [...agentStates.entries()].filter(([key]) => key.startsWith(`${channelId}:`));

  const send = (text: string, attachments: ChatAttachment[]) => {
    actions.sendMessage.mutate({ body: text, replyToId: replyTo?.id ?? null, attachments });
    setReplyTo(null);
  };

  const inboxCount = (me ?? []).length;
  const draftCount = (drafts.data ?? []).filter((d) => d.body.trim()).length;
  const savedCount = rows.filter((r) => r.saved).length;

  const createAssistant = async () => {
    const sentinel = (collaborators.data ?? []).find((c) => c.type === "sentinel");
    if (!sentinel || !sentinel.available) return;
    const created = await actions.createChannel.mutateAsync({ name: "Assistant", kind: "assistant", memberAgentIds: [sentinel.id] }).catch(() => null);
    if (created) setChannelId(created.id);
  };

  return (
    <div className="bg-background relative grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[230px_1fr] xl:grid-cols-[230px_1fr_300px]">
      {creating ? (
        <CreateChannelDialog
          agents={(collaborators.data ?? []).filter((c) => c.type !== "sentinel")}
          onClose={() => setCreating(false)}
          onCreate={(name, agentIds) => {
            actions.createChannel.mutate({ name, memberAgentIds: agentIds }, { onSuccess: (ch) => setChannelId(ch.id) });
            setCreating(false);
          }}
        />
      ) : null}
      <aside className="bg-muted/20 flex flex-col gap-3 border-r p-4 px-3">
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
            <button type="button" className="text-muted-foreground hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm" onClick={() => void createAssistant()}>
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
                  const existing = visibleChannels.find((ch) => (detail.data?.members ?? []).some((m) => m.agentId === c.id) && ch.id === channelId);
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
      </aside>

      <section className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm">
          <span className="text-muted-foreground truncate">
            {active ? (
              <>
                <span className="text-xs">#</span> {active.name}
                {active.archivedAt ? " (archived)" : ""}
              </>
            ) : (
              "No channel selected"
            )}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex shrink-0">
                {(detail.data?.members ?? []).slice(0, 4).map((m, i) => (
                  <Avatar key={m.id} size="sm" className={cn("ring-2 ring-background", i > 0 && "-ml-1.5")}>
                    <AvatarFallback className={cn("text-[9px]", m.memberType === "agent" && "bg-primary/15 text-primary")}>{initials(m.name)}</AvatarFallback>
                  </Avatar>
                ))}
              </span>
            </TooltipTrigger>
            <TooltipContent>{detail.data?.members.length ?? 0} members</TooltipContent>
          </Tooltip>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {messages.isPending ? (
            <div className="flex justify-center py-6">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground px-2 py-8 text-center text-xs">
              No messages yet — say hi{active?.kind === "assistant" ? " to your assistant" : ", @mention a collaborator to wake them"}.
            </p>
          ) : (
            <>
              {messages.data?.next ? (
                <div className="flex justify-center py-2">
                  <Button variant="ghost" size="xs" onClick={() => void messages.refetch()}>
                    Load earlier
                  </Button>
                </div>
              ) : null}
              {rows.map((p) => (
                <Post
                  key={p.id}
                  post={p}
                  mine={p.authorType === "user"}
                  onReply={() => setReplyTo(p)}
                  onReact={(emoji) => actions.react.mutate({ messageId: p.id, emoji })}
                  onPin={() => actions.pin.mutate({ messageId: p.id, pinned: p.pinned })}
                  onSave={() => actions.save.mutate({ messageId: p.id, saved: p.saved })}
                  onDelete={() => actions.remove.mutate(p.id)}
                />
              ))}
            </>
          )}
          {activeAgents.length ? (
            <div className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-xs">
              {activeAgents.map(([key, state]) => {
                const name = (detail.data?.members ?? []).find((m) => m.agentId === state.agentId)?.name ?? "agent";
                return (
                  <span key={key} className="flex items-center gap-1.5">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(name)}</AvatarFallback>
                    </Avatar>
                    {name} is {state.state === "working" ? `working (${state.detail ?? "tool"})…` : "typing…"}
                    <span className="flex gap-0.5">
                      <i className="bg-muted-foreground/70 size-1 animate-pulse rounded-full" />
                      <i className="bg-muted-foreground/50 size-1 animate-pulse rounded-full [animation-delay:150ms]" />
                      <i className="bg-muted-foreground/30 size-1 animate-pulse rounded-full [animation-delay:300ms]" />
                    </span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <Composer
          members={memberOptions}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
          onUpload={async (file) => {
            try {
              const asset = await actions.uploadAttachment(file);
              return { mediaId: asset.id, filename: asset.filename, contentType: asset.contentType };
            } catch {
              return null;
            }
          }}
          pending={actions.sendMessage.isPending}
          draftBody={draftForChannel?.body}
          onDraft={onDraft}
        />
      </section>

      <aside className="hidden min-w-0 flex-col overflow-y-auto border-l px-5 pt-3 pb-4 xl:flex">
        <Tabs value={infoTab} onValueChange={setInfoTab}>
          <TabsList className="mb-2 w-full">
            <TabsTrigger value="info" className="flex-1 text-xs">
              Info
            </TabsTrigger>
            <TabsTrigger value="pins" className="flex-1 text-xs">
              Pins
            </TabsTrigger>
            <TabsTrigger value="files" className="flex-1 text-xs">
              Files
            </TabsTrigger>
            <TabsTrigger value="links" className="flex-1 text-xs">
              Links
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {infoTab === "info" ? (
          <>
            <section className="flex flex-col gap-2 py-3">
              <h4 className="m-0 text-sm font-semibold">Main info</h4>
              <dl className="m-0 flex flex-col gap-2 text-sm">
                {[
                  ["Creator", detail.data?.creatorName ?? "—"],
                  ["Date of creation", detail.data ? new Date(detail.data.createdAt).toLocaleDateString() : "—"],
                  ["Messages", String(detail.data?.messageCount ?? 0)],
                  ["Members", String(detail.data?.members.length ?? 0)],
                ].map(([dt, dd]) => (
                  <div key={dt} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{dt}</dt>
                    <dd className="m-0 font-medium tabular-nums">{dd}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="m-0">
                    <Badge variant={active?.archivedAt ? "secondary" : "success"}>{active?.archivedAt ? "Archived" : "Active"}</Badge>
                  </dd>
                </div>
              </dl>
            </section>
            {(detail.data?.children.length ?? 0) > 0 ? (
              <section className="flex flex-col gap-2 border-t py-4">
                <h4 className="m-0 text-sm font-semibold">Linked threads</h4>
                <div className="flex flex-col gap-1.5">
                  {(detail.data?.children ?? []).map((child) => (
                    <button key={child.id} type="button" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm" onClick={() => setChannelId(child.id)}>
                      <span className="w-3 text-xs">#</span> {child.name}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="flex flex-col gap-2 border-t py-4">
              <h4 className="m-0 text-sm font-semibold">
                Members <b className="text-muted-foreground ml-1 font-normal tabular-nums">{detail.data?.members.length ?? 0}</b>
              </h4>
              <div className="flex flex-col gap-2">
                {(detail.data?.members ?? []).map((m) => {
                  const running = [...agentStates.values()].some((s) => s.agentId === m.agentId);
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="relative shrink-0">
                        <Avatar>
                          <AvatarFallback className={cn("text-xs", m.memberType === "agent" && "bg-primary/15 text-primary")}>{initials(m.name)}</AvatarFallback>
                        </Avatar>
                        {(m.memberType === "agent" && running) || m.memberType === "user" ? (
                          <i className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                        ) : null}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <strong className="truncate text-sm font-semibold">{m.name}</strong>
                        <span className="text-muted-foreground truncate text-xs">{m.role || "member"}</span>
                      </div>
                      {m.agentType ? <Badge variant={TEAM_VARIANT[m.agentType] ?? "secondary"}>{m.agentType}</Badge> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : infoTab === "pins" ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            {(pins.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-xs">Nothing pinned — hover a message and press Pin.</p>
            ) : (
              (pins.data ?? []).map((p) => (
                <div key={p.id} className="bg-card flex items-center gap-3 rounded-lg border p-3">
                  <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                    <Pin size={14} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <strong className="truncate text-sm font-semibold">{p.body.slice(0, 80) || "(attachment)"}</strong>
                    <span className="text-muted-foreground truncate text-xs">
                      {p.authorName} · pinned {when(p.pinnedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : infoTab === "files" ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            {(files.data ?? []).length === 0 ? (
              <p className="text-muted-foreground text-xs">No files yet — attach one below the composer.</p>
            ) : (
              (files.data ?? []).map((f) => (
                <a key={f.id} href={f.previewUrl} target="_blank" rel="noreferrer" className="bg-card hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors">
                  <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                    <FileText size={14} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <strong className="truncate text-sm font-semibold">{f.filename}</strong>
                    <span className="text-muted-foreground truncate text-xs">{(f.size / 1024).toFixed(1)} KB</span>
                  </div>
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t pt-4">
            {rows.filter((r) => r.meta?.linkCard).length === 0 ? (
              <p className="text-muted-foreground text-xs">Links shared in this channel appear here.</p>
            ) : (
              rows
                .filter((r) => r.meta?.linkCard)
                .map((r) => (
                  <a key={r.id} href={r.meta!.linkCard!.url} target="_blank" rel="noreferrer" className="bg-card hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors">
                    <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                      <Box size={14} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <strong className="truncate text-sm font-semibold">{r.meta!.linkCard!.url}</strong>
                      <span className="text-muted-foreground truncate text-xs">
                        {r.authorName} · {when(r.createdAt)}
                      </span>
                    </div>
                  </a>
                ))
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
