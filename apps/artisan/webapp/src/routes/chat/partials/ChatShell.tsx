import type { ComponentProps } from "react";
import { cn } from "../../../lib/cn.js";

/** Centered transcript width shared by rows + footer (legacy max-w-4xl). */
export const chatWidth = "mx-auto w-full max-w-4xl";

export function ChatShell({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-shell" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />;
}

export function ChatThread({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-thread" className={cn("relative min-h-0 flex-1", className)} {...props} />;
}

export function ChatThreadRow({ dimmed = false, className, ...props }: ComponentProps<"div"> & { dimmed?: boolean }) {
  return (
    <div
      data-slot="chat-thread-row"
      data-dimmed={dimmed || undefined}
      className={cn(chatWidth, "flex flex-col gap-6 px-4 py-1.5", dimmed && "opacity-60", className)}
      {...props}
    />
  );
}

/** Context marker rows: compaction summaries, thread breaks. */
export function ChatThreadHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-thread-header" className={cn("py-3 text-center text-sm text-ink-muted", className)} {...props} />;
}
