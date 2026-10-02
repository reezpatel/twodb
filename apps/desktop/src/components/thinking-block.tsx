import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MessageMarkdown } from "@/components/message-markdown";

export function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function ToolDuration({ startedAt, completedAt }: { startedAt?: number; completedAt?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (completedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [completedAt]);
  if (!startedAt) return null;
  const ms = (completedAt ?? now) - startedAt;
  if (ms < 0) return null;
  return <span className="text-muted-foreground/70 shrink-0 text-[11px]">{completedAt ? `took ${fmtDuration(ms)}` : fmtDuration(ms)}</span>;
}

/**
 * Thinking block shared by both chats. `visible` renders the headerless
 * markdown panel; hidden renders the collapsed-header variant instead.
 */
export function ThinkingBlock({
  text,
  live,
  durationMs,
  startedAt,
  visible,
}: {
  text: string;
  live: boolean;
  durationMs?: number;
  startedAt?: number;
  visible: boolean;
}) {
  const [collapsedOpen, setCollapsedOpen] = useState(false);
  const duration = live && startedAt ? <ToolDuration startedAt={startedAt} /> : durationMs ? <span>took {fmtDuration(durationMs)}</span> : null;

  if (visible) {
    return (
      <div className="text-sm mb-3 bg-info/5 p-4 opacity-70">
        <MessageMarkdown text={text} />
      </div>
    );
  }

  // Thinking hidden globally — keep a collapsible header instead.
  return (
    <div className="rounded-lg border border-dashed text-xs">
      <button
        className="hover:bg-accent/50 text-muted-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
        onClick={() => setCollapsedOpen((v) => !v)}
      >
        {live ? <Loader2 size={12} className="text-primary animate-spin" aria-hidden="true" /> : null}
        <span className="font-medium">{live ? "Thinking" : "Thought"}</span>
        {duration}
        <span className="text-muted-foreground/70 ml-auto shrink-0 text-[11px]">{collapsedOpen ? "hide" : "show"}</span>
      </button>
      {collapsedOpen && (
        <div className="p-4">
          <MessageMarkdown text={text} />
        </div>
      )}
    </div>
  );
}
