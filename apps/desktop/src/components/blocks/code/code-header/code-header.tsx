import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CodeHeader({ className, ...props }: ComponentProps<"header">) {
  return <header data-slot="code-header" className={cn("bg-card flex shrink-0 items-center gap-1.5 border-b px-3 py-2", className)} {...props} />;
}
