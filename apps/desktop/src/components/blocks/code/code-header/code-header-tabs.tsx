import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeHeaderShortcut } from "./code-header-shortcut";

export function CodeHeaderTabs({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-header-tabs" role="tablist" className={cn("flex items-center gap-1.5", className)} {...props} />;
}

type CodeHeaderTabProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  shortcut?: string[];
  active?: boolean;
  tooltipDelay?: number;
};

export function CodeHeaderTab({ icon, label, shortcut, active = false, tooltipDelay = 500, className, type = "button", ...props }: CodeHeaderTabProps) {
  return (
    <Tooltip delayDuration={tooltipDelay}>
      <TooltipTrigger asChild>
        <Button
          type={type}
          role="tab"
          variant="ghost"
          size="icon-sm"
          aria-selected={active}
          aria-label={label}
          data-slot="code-header-tab"
          data-active={active || undefined}
          className={cn(
            "size-7 text-muted-foreground hover:text-foreground",
            active && "text-primary hover:text-primary dark:text-info dark:hover:text-[color-mix(in_oklab,var(--info)_65%,var(--foreground))]",
            className,
          )}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="flex items-center gap-2">
        {label}
        {shortcut?.length ? <CodeHeaderShortcut keys={shortcut} /> : null}
      </TooltipContent>
    </Tooltip>
  );
}
