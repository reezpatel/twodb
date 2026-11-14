import { cn } from "@twodb/blocks";
import type { ComponentProps } from "react";

/** A sequence of messages; owns vertical rhythm but no message behavior. */
export function MessageGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-group" className={cn("flex min-w-0 flex-col", className)} {...props} />;
}
