import { cn } from "@twodb/blocks";
import type { ComponentProps } from "react";

/** Author and metadata header, mirrored for end-aligned messages. */
export function MessageHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center gap-1.5 group-data-[align=end]/message:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}
