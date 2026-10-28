import type { ComponentProps } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CodeChatComposerSendProps = Omit<ComponentProps<"button">, "children"> & {
  label: string;
};

export function CodeChatComposerSend({ label, disabled, className, type = "button", ...props }: CodeChatComposerSendProps) {
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : -1}>
          <Button
            type={type}
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            data-slot="code-chat-composer-send"
            className={cn("size-8 rounded-full transition-all", className)}
            {...props}
          >
            <ArrowUp />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
