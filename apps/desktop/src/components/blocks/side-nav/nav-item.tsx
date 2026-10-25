import type { ComponentProps, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type NavItemStatus = "none" | "running" | "completed" | "need-attention";

const STATUS_STYLES: Record<NavItemStatus, string> = {
  none: "bg-muted-foreground/30",
  running: "bg-primary animate-pulse",
  completed: "bg-success",
  "need-attention": "bg-warning ring-2 ring-warning/30",
};

const STATUS_LABELS: Record<NavItemStatus, string | undefined> = {
  none: undefined,
  running: "Running",
  completed: "Completed",
  "need-attention": "Needs attention",
};

type NavItemProps = ComponentProps<"div"> & {
  active?: boolean;
  status?: NavItemStatus;
  statusLabel?: string;
};

export function NavItem({ active = false, status = "none", statusLabel, className, children, onClick, onKeyDown, ...props }: NavItemProps) {
  const label = statusLabel ?? STATUS_LABELS[status];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <div
      data-slot="nav-item"
      data-active={active || undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group hover:bg-accent focus-visible:ring-ring mx-1 flex items-center gap-3 rounded-md px-3 py-1 text-base outline-none focus-visible:ring-2 lg:gap-2 lg:px-2 lg:py-1.5 lg:text-sm mb-0.5",
        onClick && "cursor-pointer",
        active && "bg-accent font-medium",
        className,
      )}
      {...props}
    >
      <span
        data-slot="nav-item-status"
        data-status={status}
        role={label ? "img" : undefined}
        aria-label={label}
        title={label}
        className={cn("size-2 shrink-0 rounded-full", STATUS_STYLES[status])}
      />
      {children}
    </div>
  );
}

export function NavItemLabel({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="nav-item-label" className={cn("min-w-0 flex-1 truncate text-base font-light lg:text-sm", className)} {...props} />;
}

export function NavItemMeta({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="nav-item-meta" className={cn("text-muted-foreground/70 shrink-0 text-sm lg:text-xs", className)} {...props} />;
}

export function NavItemActions({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="nav-item-actions"
      className={cn(
        "text-muted-foreground/50 flex shrink-0 items-center transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
        "has-[[data-state=open]]:opacity-100 [&_button:hover]:text-foreground [&_button]:flex [&_button]:size-8 [&_button]:items-center [&_button]:justify-center lg:[&_button]:size-auto",
        "[&_svg:not([class*='size-'])]:size-5 lg:[&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}
