import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NavRailItemProps = ComponentProps<"button"> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
};

export function NavRailItem({ icon, label, active = false, className, type = "button", ...props }: NavRailItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type={type}
          data-slot="nav-rail-item"
          data-active={active || undefined}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "text-muted-foreground relative flex size-8 shrink-0 items-center justify-center rounded-md transition-colors outline-none",
            "hover:bg-accent hover:text-foreground focus-visible:ring-ring focus-visible:ring-2",
            active &&
              "bg-primary/15 text-primary before:bg-primary before:absolute before:top-1/2 before:-left-1.5 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:content-['']",
            className,
          )}
          {...props}
        >
          <span className="flex items-center justify-center [&_svg:not([class*='size-'])]:size-4" aria-hidden="true">
            {icon}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
