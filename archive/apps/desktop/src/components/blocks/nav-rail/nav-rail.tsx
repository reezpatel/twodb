import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NavRail({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      data-slot="nav-rail"
      aria-label="Applications"
      className={cn("bg-card flex h-full w-11 shrink-0 flex-col items-center gap-1 overflow-clip border-r py-2", className)}
      {...props}
    />
  );
}
