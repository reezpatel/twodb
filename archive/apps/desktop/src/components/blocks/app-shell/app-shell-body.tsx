import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function AppShellBody({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="app-shell-body" className={cn("flex min-h-0 flex-1", className)} {...props} />;
}
