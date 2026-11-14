import type { ComponentProps } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "../../../lib/cn.js";

/** Bordered composer box (legacy code-chat-composer). */
export function ChatComposer({ busy = false, className, ...props }: ComponentProps<"div"> & { busy?: boolean }) {
  return (
    <div
      data-slot="chat-composer"
      data-busy={busy || undefined}
      className={cn("relative flex flex-col gap-1.5 rounded-md border bg-surface-muted/60 p-2 shadow-sm transition-colors", busy && "border-primary/50", className)}
      {...props}
    />
  );
}

export function ChatComposerInput({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="chat-composer-input"
      rows={1}
      className={cn("max-h-48 min-h-6 w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-muted", className)}
      {...props}
    />
  );
}

export interface InlineToken {
  /** Matches the token text exactly, e.g. "@src/app.ts" or "/compact". */
  test: (token: string) => boolean;
  className: string;
}

const TOKEN_RE = /(^|\s)([@/][^\s]*)/g;

/** Splits text into plain runs and highlighted `@file` / `/command` tokens. */
function tokenize(text: string, tokens: InlineToken[]): Array<{ text: string; className?: string }> {
  const out: Array<{ text: string; className?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    const hit = tokens.find((t) => t.test(m[2]));
    if (!hit) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: m[2], className: hit.className });
    last = start + m[2].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const INPUT_BOX = "px-1.5 py-1 text-sm";

/**
 * Textarea whose `@file` and `/command` tokens are highlighted in place, like the
 * legacy composer's mention chips. The text stays plain — what you see is what is sent.
 * A mirrored layer sits behind the transparent textarea and gives it its auto-grow height.
 */
export function ChatComposerRichInput({ className, tokens, value, ...props }: ComponentProps<"textarea"> & { tokens: InlineToken[]; value: string }) {
  const parts = tokenize(value, tokens);
  return (
    <div className={cn("relative grid max-h-48 min-h-6 overflow-y-auto", className)}>
      <div aria-hidden="true" className={cn("pointer-events-none col-start-1 row-start-1 whitespace-pre-wrap break-words text-transparent", INPUT_BOX)}>
        {parts.map((p, i) => (p.className ? <span key={i} className={cn("rounded-[5px]", p.className)}>{p.text}</span> : <span key={i}>{p.text}</span>))}
        {"\n"}
      </div>
      <textarea
        data-slot="chat-composer-input"
        rows={1}
        value={value}
        className={cn("col-start-1 row-start-1 min-h-6 w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent outline-none placeholder:text-ink-muted", INPUT_BOX)}
        {...props}
      />
    </div>
  );
}

export function ChatComposerActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-composer-actions" className={cn("flex items-center gap-1.5 px-0.5", className)} {...props} />;
}

export function ChatComposerSpacer() {
  return <span data-slot="chat-composer-spacer" className="flex-1" aria-hidden="true" />;
}

/** Round send button (legacy look). */
export function ChatComposerSend({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="chat-composer-send"
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}

/** Outline "Stop Esc" pill. */
export function ChatComposerStop({ label = "Stop", keyLabel = "Esc", className, ...props }: ComponentProps<"button"> & { label?: string; keyLabel?: string }) {
  return (
    <button
      type="button"
      data-slot="chat-composer-stop"
      className={cn(
        "flex h-8 items-center rounded-full border px-3 pr-2 text-sm text-ink transition-colors hover:bg-surface-muted",
        className,
      )}
      {...props}
    >
      {label}
      <kbd className="ml-1.5 rounded border border-outline px-1 py-0 font-mono text-[0.65rem] text-ink-muted">{keyLabel}</kbd>
    </button>
  );
}
