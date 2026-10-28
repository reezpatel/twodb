import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CodeShellMain({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-shell-main" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />;
}

export function CodeShellMainContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-shell-main-content" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />;
}
