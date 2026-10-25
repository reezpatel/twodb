import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function AppSideNavigation({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav data-slot="app-shell-side-navigation" aria-label="Side navigation" className={cn("bg-card min-w-0 flex-1 overflow-clip", className)} {...props} />
  );
}
