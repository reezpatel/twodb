import { cn } from "@twodb/blocks";
import type { ComponentProps } from "react";

/** Root message row. Alignment is expressed as data for every child primitive. */
export function Message({ className, align = "start", ...props }: ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2.5 data-[align=end]:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}
