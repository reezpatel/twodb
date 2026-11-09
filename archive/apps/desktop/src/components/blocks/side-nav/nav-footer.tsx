import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NavFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="nav-footer" className={cn("flex shrink-0 flex-col gap-0.5 border-t p-2", className)} {...props} />;
}
