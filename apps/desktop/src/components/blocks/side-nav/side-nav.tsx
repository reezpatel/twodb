import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function SideNav({ className, ...props }: ComponentProps<"aside">) {
  return <aside data-slot="side-nav" className={cn("flex h-full min-h-0 w-full flex-col overflow-clip", className)} {...props} />;
}

export function SideNavContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="side-nav-content" className={cn("min-h-0 flex-1 overflow-y-auto py-1", className)} {...props} />;
}
