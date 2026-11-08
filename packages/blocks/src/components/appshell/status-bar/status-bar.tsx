import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBarVariants = cva("flex h-6 shrink-0 items-center justify-between gap-4 px-2 font-sans text-[12px] leading-none select-none", {
  variants: {
    tone: {
      /** Solid accent bar, VSCode-blue style — the default "something is active" look. */
      accent: "bg-ion-deep text-paper",
      /** Quiet, chrome-matching bar for a more neutral shell. */
      neutral: "border-t border-outline bg-stone text-ink-muted",
    },
  },
  defaultVariants: {
    tone: "accent",
  },
});

export interface StatusBarProps extends React.ComponentProps<"footer">, VariantProps<typeof statusBarVariants> {}

/** A slim, sticky, single-row footer bar — the VSCode status bar. */
function StatusBar({ className, tone, ...props }: StatusBarProps) {
  return <footer data-slot="status-bar" className={cn(statusBarVariants({ tone }), "sticky bottom-0 z-10", className)} {...props} />;
}

function StatusBarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="status-bar-group" className={cn("flex h-full min-w-0 items-center gap-3", className)} {...props} />;
}

export interface StatusBarItemProps extends React.ComponentProps<"button"> {
  icon?: React.ReactNode;
}

/** A single clickable (or static, via `as`) segment: optional icon + label. */
function StatusBarItem({ className, icon, children, ...props }: StatusBarItemProps) {
  return (
    <button
      type="button"
      data-slot="status-bar-item"
      className={cn(
        "flex h-full shrink-0 items-center gap-1.5 px-1.5 outline-none transition-colors",
        "hover:bg-ink/10",
        "focus-visible:outline-2 focus-visible:outline-paper focus-visible:-outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {icon ? <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">{icon}</span> : null}
      {children ? <span className="truncate">{children}</span> : null}
    </button>
  );
}

export { StatusBar, StatusBarGroup, StatusBarItem, statusBarVariants };
