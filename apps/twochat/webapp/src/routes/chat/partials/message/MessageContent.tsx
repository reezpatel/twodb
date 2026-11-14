import { cn } from "@twodb/blocks";
import type { ComponentProps } from "react";

/** Flexible content column; follows the root's start/end alignment. */
export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex min-w-0 max-w-[min(82%,48rem)] flex-col break-words group-data-[align=end]/message:items-end",
        className,
      )}
      {...props}
    />
  );
}
