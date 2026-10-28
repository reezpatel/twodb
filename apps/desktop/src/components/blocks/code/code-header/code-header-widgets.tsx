import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CodeHeaderWidgets({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-header-widgets" className={cn("flex items-center gap-0.5", className)} {...props} />;
}

type CodeHeaderWidgetProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
  loading?: boolean;
  tooltipDelay?: number;
};

export function CodeHeaderWidget({
  icon,
  label,
  active = false,
  loading = false,
  tooltipDelay = 500,
  className,
  type = "button",
  ...props
}: CodeHeaderWidgetProps) {
  return (
    <Tooltip delayDuration={tooltipDelay}>
      <TooltipTrigger asChild>
        <Button
          type={type}
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-busy={loading || undefined}
          data-slot="code-header-widget"
          data-active={active || undefined}
          className={cn("size-7 text-muted-foreground hover:text-foreground", active && "text-success hover:text-success", className)}
          {...props}
        >
          {loading ? <Loader2 className="animate-spin" /> : icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
