import type { ComponentProps } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function CodeChatQueue({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-queue" className={cn("bg-card/60 flex flex-col gap-1 rounded-xl border border-dashed p-2", className)} {...props} />;
}

export function CodeChatQueueItem({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="code-chat-queue-item" className={cn("flex items-start gap-2 text-xs", className)} {...props}>
      <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono">
        <Clock aria-hidden="true" /> queued
      </Badge>
      {children}
    </div>
  );
}

export function CodeChatQueueText({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="code-chat-queue-text" className={cn("min-w-0 flex-1 pt-0.5 font-mono break-words whitespace-pre-wrap", className)} {...props} />;
}

export function CodeChatQueueActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-queue-actions" className={cn("flex shrink-0 items-center gap-0.5", className)} {...props} />;
}
