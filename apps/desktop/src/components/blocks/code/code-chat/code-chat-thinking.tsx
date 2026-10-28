import type { ComponentProps } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function CodeChatThinking({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-thinking" className={cn("mb-3 text-sm opacity-70", className)} {...props} />;
}

export function CodeChatThinkingBlock({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible data-slot="code-chat-thinking-block" className={cn("rounded-lg border border-dashed text-xs", className)} {...props} />;
}

type CodeChatThinkingHeaderProps = Omit<ComponentProps<"button">, "children"> & {
  live?: boolean;
  duration?: string;
};

export function CodeChatThinkingHeader({ live = false, duration, className, type = "button", ...props }: CodeChatThinkingHeaderProps) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type={type}
        className={cn(
          "group hover:bg-accent/50 text-muted-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        {live ? <Loader2 className="text-primary size-3 animate-spin" aria-hidden="true" /> : null}
        <span className="font-medium">{live ? "Thinking" : "Thought"}</span>
        {duration ? <span className="text-muted-foreground/70 text-[11px]">{duration}</span> : null}
        <ChevronDown
          className="text-muted-foreground/70 ml-auto size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90"
          aria-hidden="true"
        />
      </button>
    </CollapsibleTrigger>
  );
}

export function CodeChatThinkingContent({ className, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent className={cn("p-4", className)} {...props} />;
}
