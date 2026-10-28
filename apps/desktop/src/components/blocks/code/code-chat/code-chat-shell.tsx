import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CodeChatShell({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-shell" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />;
}
