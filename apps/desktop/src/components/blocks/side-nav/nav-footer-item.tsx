import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavFooterItemProps = ComponentProps<"button"> & {
  icon?: ReactNode;
  active?: boolean;
};

export function NavFooterItem({ icon, active = false, className, children, type = "button", ...props }: NavFooterItemProps) {
  return (
    <button
      type={type}
      data-slot="nav-footer-item"
      data-active={active || undefined}
      className={cn(
        "hover:bg-accent/50 focus-visible:ring-ring flex h-8 w-full items-center gap-2 text-left rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
