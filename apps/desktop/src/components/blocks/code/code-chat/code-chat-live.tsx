import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeChatLive({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="code-chat-live"
      className={cn(
        "text-muted-foreground/70 flex items-center gap-1.5 border-t border-dashed pt-3 text-[10px] font-semibold tracking-wide uppercase",
        className,
      )}
      {...props}
    >
      <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
      {children}
    </div>
  );
}

type CodeChatProgressProps = ComponentProps<"div"> & {
  size?: "sm" | "md";
};

export function CodeChatProgress({ size = "sm", className, children, ...props }: CodeChatProgressProps) {
  return (
    <div
      data-slot="code-chat-progress"
      className={cn("text-muted-foreground flex items-center gap-2", size === "sm" ? "text-xs" : "text-sm", className)}
      {...props}
    >
      <Loader2 className={cn("animate-spin", size === "sm" ? "size-3" : "size-3.5")} aria-hidden="true" />
      {children}
    </div>
  );
}
