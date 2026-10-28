import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CodeShellBottomPanelContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-shell-bottom-panel-content" className={cn("min-h-0 flex-1 overflow-auto", className)} {...props} />;
}
