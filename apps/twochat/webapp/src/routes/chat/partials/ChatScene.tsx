import { useEffect, useRef } from "react";
import { Hash, ArrowDown } from "lucide-react";
import type { Channel, Message } from "../../../lib/chat-client";
import { MessageRow } from "./MessageRow";

/**
 * Center column: header (topic), scrollable message history with
 * load-more, typing indicator strip.
 */

export interface ChatSceneProps {
  channel: Channel | null;
  channelTitle: string;
  messages: Message[];
  hasMore: boolean;
  myUserId: string | null;
  typingNames: string[];
  resolveMention?: (kind: string, id: string) => string | null;
  onLoadMore: () => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onPin: (message: Message) => void;
  onSave: (message: Message) => void;
  onDelete: (message: Message) => void;
  onAction: (message: Message, actionId: string, value?: string) => void;
  children?: React.ReactNode;
}

export function ChatScene(props: ChatSceneProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  // Stick to bottom unless the user scrolled up.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [props.messages.length, props.typingNames.length]);

  if (!props.channel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Hash size={28} />
        <p className="text-sm">Pick a channel or start a DM</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        {props.channel.kind === "dm" ? <span className="text-sm font-semibold">🔒 {props.channelTitle}</span> : (
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Hash size={14} className="opacity-60" />
            {props.channel.name}
          </span>
        )}
        {props.channel.topic ? <span className="truncate border-l border-border pl-2 text-xs text-muted-foreground">{props.channel.topic}</span> : null}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-2 py-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            if (el.scrollTop < 60 && props.hasMore) props.onLoadMore();
          }}
        >
          {props.hasMore ? (
            <div className="flex justify-center pb-2">
              <span className="text-xs text-muted-foreground">scroll up to load earlier messages</span>
            </div>
          ) : null}
          <MessageList {...props} />
        </div>
        {!stickBottomRef.current ? (
          <button
            type="button"
            aria-label="Jump to latest"
            className="absolute bottom-3 right-4 grid size-8 place-items-center rounded-full border border-border bg-card shadow-sm"
            onClick={() => {
              stickBottomRef.current = true;
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            <ArrowDown size={14} />
          </button>
        ) : null}
      </div>

      {props.typingNames.length ? (
        <div className="flex items-center gap-1.5 px-4 pb-1 text-xs text-muted-foreground">
          <span className="flex gap-0.5">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
          </span>
          {props.typingNames.join(", ")} {props.typingNames.length === 1 ? "is" : "are"} typing
        </div>
      ) : null}

      {props.children}
    </div>
  );
}

function MessageList(props: ChatSceneProps) {
  let lastAuthor: string | null = null;
  let lastDay = "";
  return (
    <div className="flex flex-col gap-0.5">
      {props.messages.map((m) => {
        const day = new Date(m.createdAt).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        const authorKey = m.authorType === "user" ? `u:${m.userId}` : `b:${m.botId}`;
        const showAuthor = showDay || authorKey !== lastAuthor || !!m.replyToId;
        lastAuthor = authorKey;
        return (
          <div key={m.id}>
            {showDay ? (
              <div className="flex items-center gap-3 py-2">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{day}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <MessageRow
              message={m}
              mine={props.myUserId !== null && m.userId === props.myUserId}
              showAuthor={showAuthor}
              resolveMention={props.resolveMention}
              onReact={props.onReact}
              onReply={props.onReply}
              onPin={props.onPin}
              onSave={props.onSave}
              onDelete={props.onDelete}
              onAction={props.onAction}
            />
          </div>
        );
      })}
      {!props.messages.length ? (
        <div className="flex flex-col items-center gap-1 py-12 text-muted-foreground">
          <span className="text-sm">This is the very beginning</span>
          <span className="text-xs">Say hello 👋</span>
        </div>
      ) : null}
    </div>
  );
}
