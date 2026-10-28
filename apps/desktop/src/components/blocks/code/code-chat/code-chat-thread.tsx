import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeChatWidth } from "./code-chat-width";

export function CodeChatThread({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-thread" className={cn("relative min-h-0 flex-1", className)} {...props} />;
}

type CodeChatThreadRowProps = ComponentProps<"div"> & {
  dimmed?: boolean;
};

export function CodeChatThreadRow({ dimmed = false, className, ...props }: CodeChatThreadRowProps) {
  return (
    <div
      data-slot="code-chat-thread-row"
      data-dimmed={dimmed || undefined}
      className={cn(codeChatWidth, "flex flex-col gap-4 py-2", dimmed && "opacity-60", className)}
      {...props}
    />
  );
}

export function CodeChatThreadHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-thread-header" className={cn("text-muted-foreground py-3 text-center text-xs", className)} {...props} />;
}

export function CodeChatThreadFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-thread-footer" className={cn(codeChatWidth, "flex flex-col gap-4 pb-6", className)} {...props} />;
}

export function CodeChatJumpButton({ className, children = "latest", type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="code-chat-jump-button"
      className={cn(
        "bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-4 bottom-4 z-10 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm outline-none focus-visible:ring-2",
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}
