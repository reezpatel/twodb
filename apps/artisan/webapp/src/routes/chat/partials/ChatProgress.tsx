import type { ComponentProps } from "react";
import { Orb, type OrbLook } from "../../../components/ui/thinking-orbs.js";
import { cn } from "../../../lib/cn.js";

const COMPACTING: OrbLook = { state: "compacting" };

/** Animated orb + label for in-flight states (thinking, compacting, status text). */
export function ChatProgress({ look = COMPACTING, className, children, ...props }: ComponentProps<"div"> & { look?: OrbLook }) {
  return (
    <div data-slot="chat-progress" className={cn("flex items-center gap-2 text-sm text-ink-muted", className)} {...props}>
      <Orb {...look} size={16} className="shrink-0 text-ink" />
      {children}
    </div>
  );
}
