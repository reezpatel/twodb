import type { ComponentProps } from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeChatClear({ className, children = "cleared", ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="code-chat-clear"
      role="separator"
      aria-label="Context cleared"
      className={cn("text-muted-foreground/80 flex items-center gap-3 py-1", className)}
      {...props}
    >
      <span className="bg-border h-px flex-1" aria-hidden="true" />
      <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-wide uppercase">
        <Eraser className="size-3" aria-hidden="true" />
        {children}
      </span>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
    </div>
  );
}
