import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Scissors, Sparkles } from "lucide-react";
import { Badge, Button } from "@twodb/blocks";
import { useSessionChat } from "./hooks/useSessionChat.js";
import { MessageBubble } from "./partials/MessageBubble.js";
import { ToolCard } from "./partials/ToolCard.js";
import { AskWidget } from "./partials/AskWidget.js";

/**
 * The full chat view for one session (rendered inside its tab): transcript,
 * streaming bubbles, tool cards, ask_user widget, plan strip, usage footer,
 * and the composer with /-commands.
 */
export function ChatView(props: { sessionId: string; onFocus?: () => void }) {
  const chat = useSessionChat(props.sessionId);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [props.sessionId]);

  const submit = () => {
    const text = input.trim();
    if (!text || chat.running) return;
    setInput("");
    if (text === "/new") void chat.newThread();
    else if (text === "/compact") void chat.compact();
    else void chat.send(text);
  };

  const detail = chat.detail;
  const plan = detail?.plan ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header strip */}
      <div className="flex items-center gap-2 border-b border-outline px-3 py-2">
        <span className="truncate text-[13px] font-medium text-ink">{detail?.title ?? props.sessionId.slice(-8)}</span>
        {detail ? <Badge tone="neutral">{detail.runner}</Badge> : null}
        {detail ? <span className="truncate font-mono text-[11px] text-ink-muted">{detail.directory}</span> : null}
        {detail ? <span className="truncate font-mono text-[11px] text-ink-muted">· {detail.model}</span> : null}
        {chat.running ? <Badge tone="info">running</Badge> : null}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => void chat.newThread()} title="Start a fresh thread (/new)">
            <Sparkles className="size-3.5" />
            New
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void chat.compact()} title="Summarize the context (/compact)">
            <Scissors className="size-3.5" />
            Compact
          </Button>
          {chat.running ? (
            <Button size="sm" variant="danger" onClick={() => void chat.abort()}>
              <Square className="size-3.5" />
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      {/* plan strip */}
      {plan && plan.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-outline bg-surface-muted/50 px-3 py-1.5">
          {plan.map((step, i) => (
            <span key={i} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
              step.status === "done" ? "text-ink-muted line-through" : step.status === "in_progress" ? "bg-info/15 text-ink" : "text-ink-muted"
            }`}>
              {step.status === "done" ? "✓" : step.status === "in_progress" ? "▸" : "·"} {step.description}
            </span>
          ))}
        </div>
      ) : null}

      {/* transcript */}
      <div ref={chat.scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {chat.error ? <p className="rounded-md border border-destructive/40 px-3 py-2 text-[12px] text-destructive">{chat.error}</p> : null}
        {chat.messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        {chat.thinking && chat.running ? (
          <details className="my-1 text-[11px] text-ink-muted">
            <summary className="cursor-pointer">thinking…</summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono">{chat.thinking}</pre>
          </details>
        ) : null}
        {chat.toolEvents.map((t) => <ToolCard key={t.id} event={t} />)}
        {chat.streamText ? (
          <div className="my-2 inline-block max-w-[92%] rounded-lg border border-outline px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
            {chat.streamText}
            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ink align-middle" />
          </div>
        ) : null}
        {chat.status ? <p className="my-1 text-[11px] text-ink-muted">{chat.status}</p> : null}
        {chat.ask ? (
          <AskWidget questions={chat.ask.questions} onAnswer={(answers) => chat.answer(chat.ask!.askId, answers)} onCancel={() => chat.cancelAsk(chat.ask!.askId)} />
        ) : null}
      </div>

      {/* usage footer */}
      <div className="flex items-center gap-3 border-t border-outline px-3 py-1 font-mono text-[10px] text-ink-muted">
        {chat.usage ? (
          <>
            <span>↑{chat.usage.inputTokens.toLocaleString()}</span>
            <span>↓{chat.usage.outputTokens.toLocaleString()}</span>
            {chat.usage.cachedTokens ? <span>cached {chat.usage.cachedTokens.toLocaleString()}</span> : null}
            <span>{chat.usage.calls} calls</span>
          </>
        ) : (
          <span>no usage yet</span>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-outline p-2.5">
        <div className="flex items-end gap-2 rounded-lg border border-outline bg-paper px-2.5 py-2">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            placeholder={detail ? `Message ${detail.title}… (/new, /compact)` : "Message…"}
            className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[13px] outline-none placeholder:text-ink-muted"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button size="sm" variant={chat.running ? "secondary" : "primary"} disabled={!input.trim() || chat.running} onClick={submit}>
            {chat.running ? <Square className="size-3.5" /> : <ArrowUp className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
