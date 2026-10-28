import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CodeShellSidebarContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-shell-sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}
