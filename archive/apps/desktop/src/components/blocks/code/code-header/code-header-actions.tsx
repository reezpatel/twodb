import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CodeHeaderShortcut } from "./code-header-shortcut";

export function CodeHeaderActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-header-actions" className={cn("ml-auto flex items-center gap-1", className)} {...props} />;
}

type CodeHeaderActionProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  shortcut?: string[];
  active?: boolean;
  tooltipDelay?: number;
};

export function CodeHeaderAction({ icon, label, shortcut, active = false, tooltipDelay = 500, className, type = "button", ...props }: CodeHeaderActionProps) {
  return (
    <Tooltip delayDuration={tooltipDelay}>
      <TooltipTrigger asChild>
        <Button
          type={type}
          variant={active ? "outline" : "ghost"}
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          data-slot="code-header-action"
          data-active={active || undefined}
          className={cn("size-7", !active && "text-muted-foreground hover:text-foreground", className)}
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
