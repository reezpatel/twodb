import { useRef, useState, type ReactNode } from "react";
import { AtSign, Bookmark, Box, FileText, Inbox, Link2, Mic, Paperclip, Pin, Plus, Search, Smile, Sparkles, User, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChatMember, ChatPost } from "./use-chat-scene";
import { useChatScene } from "./use-chat-scene";

const ACTIVITY = [0.15, 0.3, 0.15, 0.55, 0.3, 0.7, 0.15, 0.4, 0.85, 0.3, 0.55, 0.15, 0.7, 0.4, 0.15, 0.9, 0.55, 0.3, 0.15, 0.7];

const TEAM_VARIANT: Record<ChatMember["team"], "success" | "warning" | "destructive"> = {
  Design: "success",
  Management: "warning",
  Development: "destructive",
};

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function withMentions(text: string): ReactNode[] {
  return text.split(/(@[A-Z][\w/.]+(?:\s[A-Z]\.)?)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-semibold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function ReactionChip({ emoji, count }: { emoji: string; count: number }) {
  const [active, setActive] = useState(false);
  return (
    <button
      type="button"
      className={cn(
        "bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active ? "border-primary/45 bg-primary/10" : "border-border hover:border-border/80",
      )}
      onClick={() => setActive((a) => !a)}
    >
      {emoji} <b className={cn("font-semibold tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{count + (active ? 1 : 0)}</b>
    </button>
  );
}

function Post({ post, last }: { post: ChatPost; last?: boolean }) {
  return (
    <article className={cn("flex gap-3 py-3", !last && "border-b")}>
      <Avatar>
        <AvatarFallback className="text-xs">{initials(post.author)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex items-baseline gap-2">
          <strong className="text-sm font-semibold">{post.author}</strong>
          <span className="text-muted-foreground text-xs tabular-nums">{post.when}</span>
        </header>
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">{withMentions(post.body)}</p>
        {post.linkCard ? (
          <div className="bg-card flex max-w-115 items-center gap-3 rounded-lg border p-3">
            <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
              <Link2 size={14} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-sm font-semibold">{post.linkCard.title}</strong>
              <span className="text-muted-foreground truncate text-xs">{post.linkCard.url}</span>
            </div>
            <Button variant="secondary" size="xs">
              Quick view
            </Button>
          </div>
        ) : null}
        {post.reactions ? (
          <div className="flex gap-1.5">
            {post.reactions.map((r) => (
              <ReactionChip key={r.emoji} emoji={r.emoji} count={r.count} />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Composer({ members, onSend }: { members: ChatMember[]; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const atMatch = text.match(/@(\w*)$/);
  const suggestions = atMatch ? members.filter((m) => m.name.toLowerCase().includes(atMatch[1].toLowerCase())).slice(0, 4) : [];

  function insertMention(name: string) {
    setText((t) => t.replace(/@(\w*)$/, `@${name.split(" ")[0]} `));
    inputRef.current?.focus();
  }

  function send() {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <div className="relative border-t px-4 py-3">
      {suggestions.length ? (
        <div className="bg-popover absolute bottom-[calc(100%-4px)] left-4 z-50 flex min-w-50 flex-col gap-0.5 rounded-lg border p-2 shadow-xl">
          <span className="text-muted-foreground/70 px-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">Members</span>
          {suggestions.map((m) => (
            <button
              key={m.name}
              type="button"
              className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors"
              onClick={() => insertMention(m.name)}
            >
              <Avatar size="sm">
                <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
              </Avatar>
              {m.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" aria-label="AI assist">
          <Sparkles size={15} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Mention">
          <AtSign size={15} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Quick action">
          <Zap size={15} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Emoji">
          <Smile size={15} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Attach">
          <Paperclip size={15} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Voice">
          <Mic size={15} />
        </Button>
        <input
          ref={inputRef}
          className="placeholder:text-muted-foreground h-8 min-w-0 flex-1 border-none bg-transparent px-2 text-sm outline-none"
          placeholder="Write a reply… try typing @"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          aria-label="Write a reply"
        />
        <Button variant="secondary" size="sm" className="h-7 rounded-full px-4 text-xs" onClick={() => setText("")}>
          Discard
        </Button>
        <Button size="sm" className="h-7 rounded-full px-4.5 text-xs" onClick={send} disabled={!text.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

// members live in the hook file; this indirection keeps Composer props small

const QUICK = [
  { icon: Sparkles, label: "Assistant", badge: "New" },
  { icon: FileText, label: "Drafts" },
  { icon: Bookmark, label: "Saved items" },
  { icon: Inbox, label: "Inbox", count: 8 },
  { icon: User, label: "Direct messages", count: 1 },
];

export function ChatScene() {
  const chat = useChatScene();

  return (
    <div className="bg-background grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[230px_1fr] xl:grid-cols-[230px_1fr_300px]">
      <aside className="bg-muted/20 flex flex-col gap-3 border-r p-4 px-3">
        <div className="flex items-center justify-between px-1">
          <strong className="text-base font-semibold">Conceptzilla</strong>
          <Button variant="ghost" size="icon-xs" aria-label="Search workspace">
            <Search size={13} />
          </Button>
        </div>
        <nav className="flex flex-col gap-0.5">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <span key={q.label} className="text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <Icon size={15} className="shrink-0 opacity-70" />
                {q.label}
                {q.badge ? (
                  <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">
                    {q.badge}
                  </Badge>
                ) : null}
                {q.count ? <b className="ml-auto text-xs font-medium tabular-nums">{q.count}</b> : null}
              </span>
            );
          })}
        </nav>
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground/70 px-2 text-[11px] font-semibold tracking-wider uppercase">Channels</span>
          <Button variant="ghost" size="icon-xs" aria-label="Add channel">
            <Plus size={13} />
          </Button>
        </div>
        <nav className="-mr-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pr-1">
          {chat.channels.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                "hover:bg-accent/50 flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
                c.id === chat.channel ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground",
              )}
              style={{ paddingLeft: 8 + c.depth * 16 }}
              onClick={() => chat.setChannel(c.id)}
            >
              <span className="w-3 shrink-0 text-xs">{c.depth === 0 ? "#" : "↳"}</span>
              <span className="truncate">{c.label}</span>
              {c.count ? <b className="ml-auto text-xs font-medium tabular-nums">{c.count}</b> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm">
          <span className="text-muted-foreground truncate">
            <span className="text-xs">#</span> Website / v3.0 / <strong className="text-foreground font-semibold">UI-kit design</strong>
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex shrink-0">
                {chat.members.slice(0, 4).map((m, i) => (
                  <Avatar key={m.name} size="sm" className={cn("ring-2 ring-background", i > 0 && "-ml-1.5")}>
                    <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                ))}
              </span>
            </TooltipTrigger>
            <TooltipContent>9 members</TooltipContent>
          </Tooltip>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {chat.posts.map((p, i) => (
            <Post key={p.id} post={p} last={i === chat.posts.length - 1} />
          ))}
        </div>

        <Composer members={chat.members} onSend={chat.send} />
      </section>

      <aside className="hidden min-w-0 flex-col overflow-y-auto border-l px-5 pt-3 pb-4 xl:flex">
        <Tabs value={chat.infoTab} onValueChange={chat.setInfoTab}>
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

        {chat.infoTab === "info" ? (
          <>
            <section className="flex flex-col gap-2 py-3">
              <h4 className="m-0 text-sm font-semibold">Main info</h4>
              <dl className="m-0 flex flex-col gap-2 text-sm">
                {[
                  ["Creator", "Andrew M."],
                  ["Date of creation", "28 May"],
                  ["Tags", "13"],
                  ["Tasks", "4"],
                ].map(([dt, dd]) => (
                  <div key={dt} className="flex items-center justify-between">
                    <dt className="text-muted-foreground">{dt}</dt>
                    <dd className="m-0 font-medium tabular-nums">{dd}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="m-0">
                    <Badge variant="success">Active</Badge>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="flex flex-col gap-2 border-t py-4">
              <h4 className="m-0 text-sm font-semibold">Linked threads</h4>
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <span className="w-3 text-xs">#</span> Front-end <b className="ml-auto font-medium tabular-nums">4</b>
                </span>
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <span className="w-3 text-xs">#</span> UI-kit design standards
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-2 border-t py-4">
              <h4 className="m-0 text-sm font-semibold">Thread activity</h4>
              <div className="flex flex-wrap gap-1">
                {ACTIVITY.map((v, i) => (
                  <span key={i} className="bg-primary size-3 rounded-sm" style={{ opacity: v }} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2 border-t py-4">
              <h4 className="m-0 text-sm font-semibold">
                Members <b className="text-muted-foreground ml-1 font-normal tabular-nums">9</b>
              </h4>
              <div className="flex flex-col gap-2">
                {chat.members.map((m) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <span className="relative shrink-0">
                      <Avatar>
                        <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      {m.online ? <i className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" /> : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <strong className="truncate text-sm font-semibold">{m.name}</strong>
                      <span className="text-muted-foreground truncate text-xs">{m.role}</span>
                    </div>
                    <Badge variant={TEAM_VARIANT[m.team]}>{m.team}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : chat.infoTab === "pins" ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                <Pin size={14} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <strong className="truncate text-sm font-semibold">UI-kit is 90% complete</strong>
                <span className="text-muted-foreground truncate text-xs">Diana Taylor · pinned 2d ago</span>
              </div>
            </div>
          </div>
        ) : chat.infoTab === "files" ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            {[
              ["Lottie-animations.zip", "4.1 MB"],
              ["ui-kit-v3.fig", "12 MB"],
            ].map(([name, size]) => (
              <div key={name} className="bg-card flex items-center gap-3 rounded-lg border p-3">
                <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                  <FileText size={14} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-sm font-semibold">{name}</strong>
                  <span className="text-muted-foreground truncate text-xs">{size}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t pt-4">
            <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                <Box size={14} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <strong className="truncate text-sm font-semibold">Conceptzilla website v.3.0</strong>
                <span className="text-muted-foreground truncate text-xs">www.figma.com</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
