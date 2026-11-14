import { cn } from "@twodb/blocks";
import type { ComponentProps } from "react";

/** Avatar rail aligned to the bottom edge of the message content. */
export function MessageAvatar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn("flex w-fit shrink-0 items-center justify-center self-end overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}
