import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SideNavHeaderProps = ComponentProps<"div"> & {
  title: string;
};

export function SideNavHeader({ title, className, children, ...props }: SideNavHeaderProps) {
  return (
    <div data-slot="side-nav-header" className={cn("flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2", className)} {...props}>
      <span className="min-w-0 truncate text-sm font-medium">{title}</span>
      {children ? <div className="flex shrink-0 gap-1">{children}</div> : null}
    </div>
  );
}
