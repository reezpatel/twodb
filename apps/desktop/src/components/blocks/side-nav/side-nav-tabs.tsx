import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SideNavTabs({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="side-nav-tabs" role="tablist" className={cn("flex shrink-0 gap-0.5 overflow-x-auto border-b px-1.5 py-1.5", className)} {...props} />;
}

type SideNavTabProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
  tooltipDelay?: number;
};

export function SideNavTab({ icon, label, active = false, tooltipDelay = 500, className, type = "button", ...props }: SideNavTabProps) {
  return (
    <Tooltip delayDuration={tooltipDelay}>
      <TooltipTrigger asChild>
        <button
          type={type}
          role="tab"
          aria-selected={active}
          aria-label={label}
          data-slot="side-nav-tab"
          data-active={active || undefined}
          className={cn(
            "flex h-7 flex-1 shrink-0 items-center justify-center rounded-md transition-colors outline-none [&_svg:not([class*='size-'])]:size-4",
            "focus-visible:ring-ring focus-visible:ring-2",
            active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            className,
          )}
          {...props}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
