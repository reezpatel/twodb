import type { ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { codeChatWidth } from "../code-chat/code-chat-width";

export function CodeChatFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-footer" className={cn(codeChatWidth, "flex shrink-0 flex-col gap-2 pb-4", className)} {...props} />;
}

type CodeChatFooterNoticeProps = ComponentProps<"div"> & {
  tone?: "error" | "warning";
};

export function CodeChatFooterNotice({ tone = "error", className, children, ...props }: CodeChatFooterNoticeProps) {
  const warning = tone === "warning";

  return (
    <div
      data-slot="code-chat-footer-notice"
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

/** Socket dropped; the client is retrying. Spinner + status label + detail. */
export function CodeChatReconnecting({
  className,
  label = "Reconnecting",
  children = "retrying connection",
  ...props
}: ComponentProps<"div"> & { label?: string }) {
  return (
    <div data-slot="code-chat-reconnecting" role="status" className={cn("flex items-center gap-2 px-1 pt-3 text-sm", className)} {...props}>
      <Spinner className="text-warning size-3.5" aria-hidden="true" />
      <span>
        <span className="text-warning font-medium">{label}</span>
        <span className="text-muted-foreground"> — {children}</span>
      </span>
    </div>
  );
}

export function CodeChatStatusBar({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-status-bar" className={cn("flex flex-col gap-1 pt-1", className)} {...props} />;
}
