import { useState } from "react";
import { Code2, Undo2 } from "lucide-react";
import type { Message } from "../../../lib/chat-client";
import { artisanSessionUrl } from "../../../lib/artisan-link";
import { MessageBubble } from "../MessageBubble";
import { BlockView } from "./BlockView";

/** One chat post. Presentational only — all mutations arrive as callbacks. */
export interface MessageRowProps {
  message: Message;
  mine: boolean;
  showAuthor: boolean;
  readOnly?: boolean;
  resolveMention?: (kind: string, id: string) => string | null;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onPin: (message: Message) => void;
  onSave: (message: Message) => void;
  onDelete: (message: Message) => void;
  onAction: (message: Message, actionId: string, value?: string) => void;
  /** Present only where rolling back makes sense (a conversation with a collaborator). */
  onRollback?: (message: Message, restoreFiles: boolean) => void;
}

export function MessageRow(props: MessageRowProps) {
  const { message: m, mine } = props;
  const [confirmingRollback, setConfirmingRollback] = useState(false);

  if (m.deletedAt) {
    return (
      <div id={`post-${m.id}`} className={`flex py-1 ${mine ? "justify-end pr-12" : "justify-start pl-12"}`}>
        <span className="rounded-full border border-dashed border-border px-3 py-1 text-xs italic text-muted-foreground">message deleted</span>
      </div>
    );
  }

  const initials = (m.authorName || "?")
    .split(/[\s-_]+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Cards/code/callouts already draw their own surface. Avoid wrapping a
  // stack of cards in another tinted box while keeping simple text bubble-like.
  const carriesOwnSurface =
    m.authorType === "bot" &&
    !!m.blocks?.some((block) => ["callout", "code", "link-card", "image", "status", "task-list"].includes(block.type));

  return (
    <div id={`post-${m.id}`} className="group/row py-0.5">
      <MessageBubble
        avatar={
          props.showAuthor ? (
            m.authorAvatarUrl ? (
              <img src={m.authorAvatarUrl} alt="" className="size-8 rounded-full object-cover shadow-sm" />
            ) : (
              <div
                className={`grid size-8 place-items-center rounded-full text-xs font-medium shadow-sm ${
                  m.authorType === "bot" ? "bg-primary/15 text-primary" : mine ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                }`}
                title={m.authorType === "bot" ? `${m.authorName} (bot)` : m.authorName}
              >
                {m.authorEmoji ?? initials}
              </div>
            )
          ) : (
            <div className="size-8" aria-hidden="true" />
          )
        }
        authorName={m.authorName}
        badge={m.authorType === "bot" ? "AI" : undefined}
        bubble={!carriesOwnSurface}
        copyText={m.text || undefined}
        isMine={mine}
        isPinned={m.pinned}
        isSaved={m.saved}
        showHeader={props.showAuthor}
        timestamp={`${when(m.createdAt)}${m.editedAt ? " · edited" : ""}`}
        onDelete={mine && !props.readOnly ? () => props.onDelete(m) : undefined}
        onPin={!props.readOnly ? () => props.onPin(m) : undefined}
        onReact={!props.readOnly ? (emoji) => props.onReact(m, emoji) : undefined}
        onReply={!props.readOnly ? () => props.onReply(m) : undefined}
        onSave={() => props.onSave(m)}
        onVote={m.authorType === "bot" && !mine && !props.readOnly ? (vote) => props.onReact(m, vote === "up" ? "👍" : "👎") : undefined}
      >
        <div className="flex min-w-0 flex-col gap-2">
          {m.replyTo ? (
            <a
              href={`#post-${m.replyTo.id}`}
              className={`flex w-fit max-w-full items-center gap-1.5 rounded-md border-l-2 px-2 py-1 text-left text-xs ${
                mine ? "border-background/50 bg-background/10 text-background/80" : "border-primary/40 bg-background/40 text-muted-foreground"
              }`}
            >
              <span className="shrink-0">↩</span>
              <span className={mine ? "shrink-0 font-medium text-background" : "shrink-0 font-medium text-primary"}>@{m.replyTo.authorName}</span>
              <span className="truncate">{m.replyTo.snippet}</span>
            </a>
          ) : null}

          {m.blocks?.length ? (
            <div className="flex min-w-0 flex-col gap-2">
              {m.blocks.map((block, index) => (
                <BlockView
                  key={index}
                  block={block}
                  resolveMention={props.resolveMention}
                  onAction={(actionId, value) => props.onAction(m, actionId, value)}
                />
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
          )}

          {m.collab?.sessionId ? (
            <a
              href={artisanSessionUrl(m.collab.sessionId)}
              target="_blank"
              rel="noopener"
              className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              title="Open the session this reply came from — tool calls, file changes, the full run"
            >
              <Code2 size={12} /> View code session
            </a>
          ) : null}

          {props.onRollback && mine && !props.readOnly ? (
            confirmingRollback ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">Hide this and everything after, and undo the work done since:</span>
                <button type="button" className="rounded border border-border px-1.5 py-0.5 hover:bg-muted" onClick={() => { props.onRollback?.(m, false); setConfirmingRollback(false); }}>messages only</button>
                <button type="button" className="rounded border border-border px-1.5 py-0.5 hover:bg-muted" onClick={() => { props.onRollback?.(m, true); setConfirmingRollback(false); }}>messages + files</button>
                <button type="button" className="px-1 text-muted-foreground hover:text-foreground" onClick={() => setConfirmingRollback(false)}>cancel</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRollback(true)}
                className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100 focus:opacity-100"
                title="Go back to just before this message — your text is put back in the composer so you can edit and resend"
              >
                <Undo2 size={12} /> Roll back to before this
              </button>
            )
          ) : null}

          {props.readOnly && m.sourceUrl ? (
            <a href={m.sourceUrl} target="_blank" rel="noopener" className="text-[11px] text-primary hover:underline">View original</a>
          ) : null}

          {m.reactions.length ? (
            <div className={`flex flex-wrap gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {m.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => props.onReact(m, reaction.emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    mine
                      ? reaction.mine
                        ? "border-background/70 bg-background/20 text-background"
                        : "border-background/30 bg-background/10 text-background/80 hover:bg-background/20"
                      : reaction.mine
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {reaction.emoji} {reaction.count}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </MessageBubble>
    </div>
  );
}

function when(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
