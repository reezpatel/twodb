import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

type CodeChatComposerStopProps = Omit<ComponentProps<"button">, "children"> & {
  label?: string;
  keyLabel?: string;
};

/** Outline "Stop  Esc" button. Clickable for touch; Esc itself is handled by the caller (useEscapeKey). */
export function CodeChatComposerStop({ label = "Stop", keyLabel = "Esc", className, type = "button", ...props }: CodeChatComposerStopProps) {
  return (
    <Button
      type={type}
      variant="secondary"
      size="sm"
      aria-label={`${label} (${keyLabel})`}
      aria-keyshortcuts="Escape"
      data-slot="code-chat-composer-stop"
      className={cn("text-foreground h-8 rounded-full pr-2", className)}
      {...props}
    >
      {label}
      <Kbd className="border-border bg-background text-muted-foreground/70 ml-1 h-5 rounded border px-1 text-[0.625rem]">{keyLabel}</Kbd>
    </Button>
  );
}
