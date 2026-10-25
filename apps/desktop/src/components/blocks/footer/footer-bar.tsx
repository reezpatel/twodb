import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FooterBar({ className, children, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      data-slot="footer-bar"
      className={cn(
        "bg-card text-muted-foreground flex h-8 shrink-0 items-center gap-4 overflow-clip border-t text-sm lg:h-6 lg:text-xs",
        "[&_[data-slot=footer-widget]]:h-10 lg:[&_[data-slot=footer-widget]]:h-6",
        "[&_svg:not([class*='size-'])]:size-4 lg:[&_svg:not([class*='size-'])]:size-[12px]",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center">{children}</div>
    </footer>
  );
}
