import { Smile, MessageSquare, Bookmark, Pin, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import type { Message } from "../../../lib/chat-client";
import { BlockView } from "./BlockView";

/**
 * One chat post. Presentational only — all mutations arrive as callbacks.
 */

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "👀", "🤔"];

export interface MessageRowProps {
  message: Message;
  mine: boolean;
  showAuthor: boolean;
  resolveMention?: (kind: string, id: string) => string | null;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onPin: (message: Message) => void;
  onSave: (message: Message) => void;
  onDelete: (message: Message) => void;
  onAction: (message: Message, actionId: string, value?: string) => void;
}

export function MessageRow(props: MessageRowProps) {
  const { message: m, mine, showAuthor } = props;

  if (m.deletedAt) {
    return (
      <div id={`post-${m.id}`} className="flex items-center gap-2 py-1 pl-11 text-xs italic text-muted-foreground">
        message deleted
      </div>
    );
  }

  const initials = (m.authorName || "?")
    .split(/[\s-_]+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div id={`post-${m.id}`} className="group/post relative flex gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
      <div
        className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-medium ${
          m.authorType === "bot" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
        title={m.authorType === "bot" ? `${m.authorName} (bot)` : m.authorName}
      >
        {m.authorEmoji ?? initials}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {showAuthor ? (
          <header className="flex items-baseline gap-2">
            <strong className="text-sm font-semibold">
              {m.authorName}
              {m.authorType === "bot" ? <span className="ml-1.5 text-[10px] font-medium uppercase text-primary">AI</span> : null}
            </strong>
            <span className="text-xs tabular-nums text-muted-foreground">{when(m.createdAt)}</span>
            {m.editedAt ? <span className="text-[10px] text-muted-foreground">(edited)</span> : null}
            {m.pinned ? <Pin className="size-3 text-amber-500" /> : null}
          </header>
        ) : null}

        {m.replyTo ? (
          <a
            href={`#post-${m.replyTo.id}`}
            className="flex w-fit max-w-full items-center gap-1.5 rounded-md border-l-2 border-primary/40 bg-muted/50 px-2 py-1 text-left text-xs"
          >
            <span className="shrink-0 text-muted-foreground">↩</span>
            <span className="shrink-0 font-medium text-primary">@{m.replyTo.authorName}</span>
            <span className="truncate text-muted-foreground">{m.replyTo.snippet}</span>
          </a>
        ) : null}

        {m.blocks?.length ? (
          <div className="flex flex-col gap-2">
            {m.blocks.map((b, i) => (
              <BlockView key={i} block={b} resolveMention={props.resolveMention} onAction={(actionId, value) => props.onAction(m, actionId, value)} />
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
        )}

        {m.reactions.length ? (
          <div className="flex gap-1.5">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => props.onReact(m, r.emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  r.mine ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm group-hover/post:flex">
        {QUICK_EMOJI.slice(0, 3).map((emoji) => (
          <Button key={emoji} variant="ghost" size="sm" aria-label={`React ${emoji}`} onClick={() => props.onReact(m, emoji)}>
            {emoji}
          </Button>
        ))}
        <Button variant="ghost" size="sm" aria-label="More reactions" onClick={() => props.onReact(m, QUICK_EMOJI[3])}>
          <Smile size={13} />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Reply" onClick={() => props.onReply(m)}>
          <MessageSquare size={13} />
        </Button>
        <Button variant="ghost" size="sm" aria-label={m.pinned ? "Unpin" : "Pin"} onClick={() => props.onPin(m)}>
          <Pin size={13} />
        </Button>
        <Button variant="ghost" size="sm" aria-label={m.saved ? "Unsave" : "Save"} onClick={() => props.onSave(m)}>
          <Bookmark size={13} className={m.saved ? "fill-current text-primary" : undefined} />
        </Button>
        {mine ? (
          <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => props.onDelete(m)}>
            <Trash2 size={13} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
