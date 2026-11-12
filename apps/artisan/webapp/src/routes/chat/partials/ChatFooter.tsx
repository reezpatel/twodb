import type { ComponentProps } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import { chatWidth } from "./ChatShell.js";

export function ChatFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-footer" className={cn(chatWidth, "flex shrink-0 flex-col gap-2 px-4 pb-3", className)} {...props} />;
}

/** Error/warning notice above the composer. */
export function ChatFooterNotice({ tone = "error", className, children, ...props }: ComponentProps<"div"> & { tone?: "error" | "warning" }) {
  const warning = tone === "warning";
  return (
    <div
      data-slot="chat-footer-notice"
      data-tone={tone}
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs",
        warning ? "border-warning/40 bg-warning/5 text-warning" : "border-destructive/40 bg-destructive/5 text-destructive",
        className,
      )}
      {...props}
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** Socket dropped — spinner + status. */
export function ChatReconnecting({ className, label = "Reconnecting", children = "retrying connection", ...props }: ComponentProps<"div"> & { label?: string }) {
  return (
    <div data-slot="chat-reconnecting" role="status" className={cn("flex items-center gap-2 px-1 pt-2 text-sm", className)} {...props}>
      <Loader2 className="size-3.5 animate-spin text-warning" aria-hidden="true" />
      <span>
        <span className="font-medium text-warning">{label}</span>
        <span className="text-ink-muted"> — {children}</span>
      </span>
    </div>
  );
}

/** Status line strip under the composer (usage stats live here). */
export function ChatStatusBar({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-status-bar" className={cn("flex flex-col gap-1 pt-1", className)} {...props} />;
}
