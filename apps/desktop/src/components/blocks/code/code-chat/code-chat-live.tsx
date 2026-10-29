import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Orb, type OrbLook } from "@/components/ui/thinking-orbs";

export function CodeChatLive({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="code-chat-live"
      className={cn(
        "text-muted-foreground/70 flex items-center gap-1.5 border-t border-dashed pt-3 text-[13px] font-semibold tracking-wide uppercase",
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
  /** Which orb to show; compacting unless told otherwise. */
  look?: OrbLook;
};

const COMPACTING: OrbLook = { state: "compacting" };

export function CodeChatProgress({ size = "sm", look = COMPACTING, className, children, ...props }: CodeChatProgressProps) {
  return (
    <div
      data-slot="code-chat-progress"
      className={cn("text-muted-foreground flex items-center gap-2", size === "sm" ? "text-sm" : "text-base", className)}
      {...props}
    >
      <Orb {...look} size={size === "sm" ? 16 : 20} className="text-primary shrink-0" />
      {children}
    </div>
  );
}
