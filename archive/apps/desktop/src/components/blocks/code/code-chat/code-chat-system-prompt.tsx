import type { ComponentProps } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function CodeChatSystemPrompt({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible data-slot="code-chat-system-prompt" className={cn("bg-card/60 rounded-sm", className)} {...props} />;
}

type CodeChatSystemPromptHeaderProps = Omit<ComponentProps<"button">, "children"> & {
  summary?: string;
  loading?: boolean;
};

export function CodeChatSystemPromptHeader({ summary, loading = false, className, type = "button", ...props }: CodeChatSystemPromptHeaderProps) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type={type}
        className={cn(
          "group hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        <FileText className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[13px] font-semibold tracking-wide uppercase">System prompt</span>
        {summary ? <span className="text-muted-foreground text-[13px]">{summary}</span> : null}
        {loading ? <span className="text-muted-foreground/70 text-[13px]">loading…</span> : null}
        <ChevronDown
          className="text-muted-foreground/70 ml-auto size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90"
          aria-hidden="true"
        />
      </button>
    </CollapsibleTrigger>
  );
}

export function CodeChatSystemPromptContent({ className, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent className={cn("border-t", className)} {...props} />;
}

export function CodeChatSystemPromptText({ className, ...props }: ComponentProps<"pre">) {
  return (
    <pre
      data-slot="code-chat-system-prompt-text"
      className={cn("text-muted-foreground max-h-96 overflow-y-auto px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap", className)}
      {...props}
    />
  );
}

export function CodeChatSystemPromptWarning({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="code-chat-system-prompt-warning" className={cn("text-destructive px-3 py-2 text-[13px] leading-relaxed", className)} {...props} />;
}
