import * as React from "react";
import { cn } from "@/lib/utils";

/** The fixed, icon-only navigation rail — always visible, never collapses or resizes. */
function IconRail({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="icon-rail"
      className={cn("flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-outline bg-stone py-3", className)}
      {...props}
    />
  );
}

function IconRailSpacer({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="icon-rail-spacer" className={cn("flex-1", className)} {...props} />;
}

export interface IconRailItemProps extends React.ComponentProps<"button"> {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number | string;
}

/** A single icon button in the rail. `label` is used as the tooltip/accessible name. */
function IconRailItem({ className, icon: Icon, label, active = false, badge, ...props }: IconRailItemProps) {
  return (
    <button
      type="button"
      data-slot="icon-rail-item"
      data-active={active}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-[10px] outline-none transition-colors",
        active ? "bg-paper text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {active ? <span aria-hidden className="absolute left-0 h-5 w-[3px] -translate-x-1.5 rounded-full bg-ion-deep" /> : null}
      <Icon className="size-4" strokeWidth={1.5} />
      {badge ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export { IconRail, IconRailSpacer, IconRailItem };
