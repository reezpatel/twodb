import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function AppShellWorkspace({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="app-shell-workspace" className={cn("flex h-full min-h-0 min-w-0 flex-1", className)} {...props} />;
}
