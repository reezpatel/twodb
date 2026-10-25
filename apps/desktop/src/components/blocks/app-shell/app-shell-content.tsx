import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function AppShellContent({ className, ...props }: ComponentProps<"main">) {
  return <main data-slot="app-shell-content" className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", className)} {...props} />;
}
