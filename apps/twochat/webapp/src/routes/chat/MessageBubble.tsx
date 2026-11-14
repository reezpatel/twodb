import { cn } from "@twodb/blocks";
import { Bookmark, Check, Copy, MessageSquare, Pin, Smile, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMessageBubbleActions } from "./hooks/useMessageBubbleActions";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "./partials/message";

const ACTION_STAGGER_MS = 30;

/**
 * Actions remain mounted and reveal with CSS, so hovering/focusing never
 * changes a message's height or pushes later messages around.
 */
const ACTION_STYLES = `
.twochat-message-action {
  opacity: 0;
  transform: translateX(var(--twochat-message-slide)) scale(.9);
  transition:
    opacity 200ms cubic-bezier(.23, 1, .32, 1),
    transform 200ms cubic-bezier(.23, 1, .32, 1),
    background-color 150ms ease,
    color 150ms ease;
}
.twochat-message-action-left { --twochat-message-slide: -6px; }
.twochat-message-action-right { --twochat-message-slide: 6px; }
.twochat-message-root:hover .twochat-message-action,
.twochat-message-root:focus-within .twochat-message-action {
  opacity: 1;
  transform: translateX(0) scale(1);
}
.twochat-message-pop { animation: twochat-message-pop 250ms cubic-bezier(.23, 1, .32, 1); }
@keyframes twochat-message-pop {
  0% { transform: scale(1); }
  45% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
@media (hover: none) {
  .twochat-message-action { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .twochat-message-action { transition-duration: 0ms; transition-delay: 0ms !important; transform: none; }
  .twochat-message-root:hover .twochat-message-action,
  .twochat-message-root:focus-within .twochat-message-action { transform: none; }
  .twochat-message-pop { animation: none; }
}
`;

export interface MessageBubbleProps {
  avatar?: ReactNode;
  authorName: string;
  badge?: string;
  bubble?: boolean;
  children: ReactNode;
  className?: string;
  copyText?: string;
  isMine?: boolean;
  isPinned?: boolean;
  isSaved?: boolean;
  showHeader?: boolean;
  timestamp?: string;
  onDelete?: () => void;
  onPin?: () => void;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onSave?: () => void;
  onVote?: (vote: "up" | "down") => void;
}

/**
 * Conversation bubble inspired by the supplied AIMessage UI: the current
 * user's turns anchor right, everyone else anchors left, and the action row
 * slides from the bubble's own edge on hover or keyboard focus.
 */
export function MessageBubble(props: MessageBubbleProps) {
  const { hasCopied, vote, copy, castVote } = useMessageBubbleActions(props.copyText, props.onVote);
  const isMine = props.isMine === true;

  const actions = [
    props.copyText
      ? { key: "copy", label: hasCopied ? "Copied" : "Copy", active: hasCopied, icon: hasCopied ? Check : Copy, onClick: copy }
      : null,
    props.onReply
      ? { key: "reply", label: "Reply", active: false, icon: MessageSquare, onClick: props.onReply }
      : null,
    props.onReact
      ? { key: "react", label: "React", active: false, icon: Smile, onClick: () => props.onReact?.("🎉") }
      : null,
    props.onVote && !isMine
      ? { key: "up", label: "Good response", active: vote === "up", icon: ThumbsUp, onClick: () => castVote("up") }
      : null,
    props.onVote && !isMine
      ? { key: "down", label: "Bad response", active: vote === "down", icon: ThumbsDown, onClick: () => castVote("down") }
      : null,
    props.onPin
      ? { key: "pin", label: props.isPinned ? "Unpin" : "Pin", active: props.isPinned === true, icon: Pin, onClick: props.onPin }
      : null,
    props.onSave
      ? { key: "save", label: props.isSaved ? "Remove from saved" : "Save", active: props.isSaved === true, icon: Bookmark, onClick: props.onSave }
      : null,
    props.onDelete
      ? { key: "delete", label: "Delete", active: false, icon: Trash2, onClick: props.onDelete }
      : null,
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  return (
    <Message align={isMine ? "end" : "start"} className={cn("twochat-message-root px-2 py-1", props.className)}>
      <style dangerouslySetInnerHTML={{ __html: ACTION_STYLES }} />

      {props.avatar ? <MessageAvatar className="mb-7">{props.avatar}</MessageAvatar> : null}

      <MessageContent className="gap-1">
        {props.showHeader !== false ? (
          <MessageHeader className="px-1">
            <strong className="truncate text-xs font-semibold">{props.authorName}</strong>
            {props.badge ? <span className="text-[9px] font-semibold uppercase tracking-wide text-primary">{props.badge}</span> : null}
          </MessageHeader>
        ) : null}

        <div
          className={cn(
            "w-fit max-w-full text-sm leading-relaxed",
            props.bubble !== false && "rounded-2xl px-3.5 py-2.5 shadow-sm",
            props.bubble !== false && isMine && "rounded-br-md bg-foreground text-background",
            props.bubble !== false && !isMine && "rounded-bl-md border border-border/70 bg-muted/80 text-foreground",
            props.bubble === false && "text-foreground",
          )}
        >
          {props.children}
        </div>

        <MessageFooter className="px-1">
          {props.timestamp ? <span className="px-1 text-[11px] tabular-nums text-muted-foreground">{props.timestamp}</span> : null}
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                aria-label={action.label}
                aria-pressed={action.active}
                className={cn(
                  "twochat-message-action cursor-pointer rounded-lg p-1.5",
                  isMine ? "twochat-message-action-right" : "twochat-message-action-left",
                  action.active ? "text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  action.key === "delete" && "hover:bg-destructive/10 hover:text-destructive",
                )}
                key={action.key}
                onClick={action.onClick}
                style={{ transitionDelay: `${index * ACTION_STAGGER_MS}ms` }}
                type="button"
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    action.key === "copy" && hasCopied && "twochat-message-pop",
                    action.key === "save" && props.isSaved && "fill-current",
                    action.key === "pin" && props.isPinned && "fill-current",
                  )}
                  key={action.key === "copy" && hasCopied ? "copied" : "idle"}
                  size={14}
                />
              </button>
            );
          })}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
