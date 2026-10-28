import type { ComponentProps } from "react";
import { Archive, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function CodeChatCompaction({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible data-slot="code-chat-compaction" className={cn("bg-card/60 rounded-lg border border-dashed", className)} {...props} />;
}

type CodeChatCompactionHeaderProps = Omit<ComponentProps<"button">, "children"> & {
  tokens: string;
  model?: string;
};

export function CodeChatCompactionHeader({ tokens, model, className, type = "button", ...props }: CodeChatCompactionHeaderProps) {
  return (
    <CollapsibleTrigger asChild>
      <button
        type={type}
        className={cn(
          "group hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        <Archive className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-wide uppercase">Compacted</span>
        <span className="text-muted-foreground font-mono text-[11px]">{tokens}</span>
        {model ? <span className="text-muted-foreground/70 truncate font-mono text-[10px]">{model}</span> : null}
        <ChevronDown
          className="text-muted-foreground/70 ml-auto size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90"
          aria-hidden="true"
        />
      </button>
    </CollapsibleTrigger>
  );
}

export function CodeChatCompactionContent({ className, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent className={cn("border-t px-3 py-2", className)} {...props} />;
}

export function CodeChatCompactionMeta({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="code-chat-compaction-meta"
      className={cn("text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px]", className)}
      {...props}
    />
  );
}
