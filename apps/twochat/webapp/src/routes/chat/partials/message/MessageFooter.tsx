import { cn } from "@twodb/blocks";
import type { ComponentProps } from "react";

/** Timestamp/action row mirrored by the parent message's data alignment. */
export function MessageFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex min-h-7 max-w-full min-w-0 items-center gap-0.5 group-data-[align=end]/message:flex-row-reverse group-data-[align=end]/message:justify-end",
        className,
      )}
      {...props}
    />
  );
}
