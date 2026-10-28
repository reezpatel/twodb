import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type CodeChatComposerActionProps = Omit<ComponentProps<"button">, "children"> & {
  icon: ReactNode;
  label: string;
  shortcut?: string[];
  loading?: boolean;
};

export function CodeChatComposerAction({ icon, label, shortcut, loading = false, className, type = "button", ...props }: CodeChatComposerActionProps) {
  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Button
          type={type}
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-busy={loading || undefined}
          data-slot="code-chat-composer-action"
          className={cn("text-muted-foreground hover:text-foreground size-8 rounded-full", className)}
          {...props}
        >
          {loading ? <Loader2 className="animate-spin" /> : icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        {label}
        {shortcut?.length ? (
          <KbdGroup>
            {shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
