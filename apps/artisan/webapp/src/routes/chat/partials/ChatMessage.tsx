import type { ComponentProps } from "react";
import { cn } from "../../../lib/cn.js";

/**
 * Message rows in the legacy style: user messages are right-shifted tinted
 * bubbles pushed down with generous top margin; assistant messages render
 * as open text — no bubble, no chrome.
 */
export function ChatMessage({ variant = "assistant", className, children, ...props }: ComponentProps<"div"> & { variant?: "user" | "assistant" }) {
  const user = variant === "user";
  return (
    <div data-slot="chat-message" data-variant={variant} className={cn("flex flex-col", user ? "mt-16" : "gap-0.5", className)} {...props}>
      <div className={cn(user && "ms-5 rounded-sm bg-surface-muted px-4 py-3 md:ms-20 lg:ms-40")}>{children}</div>
    </div>
  );
}

/** Compact monospace note under an assistant message (tools used, timings). */
export function ChatMessageNote({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="chat-message-note" className={cn("font-mono text-[11px] text-ink-muted", className)} {...props} />;
}
