import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type CodeChatToolProps = ComponentProps<typeof Collapsible> & {
  failed?: boolean;
};

export function CodeChatTool({ failed = false, className, ...props }: CodeChatToolProps) {
  return (
    <Collapsible
      data-slot="code-chat-tool"
      data-failed={failed || undefined}
      className={cn("rounded-lg border text-xs", failed ? "bg-destructive/10 border-destructive/40" : "bg-muted/60", className)}
      {...props}
    />
  );
}

type CodeChatToolHeaderProps = Omit<ComponentProps<"button">, "children"> & {
  label: string;
  preview?: string;
  duration?: string;
  running?: boolean;
  expandable?: boolean;
};

export function CodeChatToolHeader({
  label,
  preview,
  duration,
  running = false,
  expandable = false,
  className,
  type = "button",
  ...props
}: CodeChatToolHeaderProps) {
  return (
    <CollapsibleTrigger asChild disabled={!expandable}>
      <button
        type={type}
        className={cn(
          "group hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono outline-none focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent",
          className,
        )}
        {...props}
      >
        {running ? <Loader2 className="text-primary size-3 animate-spin" aria-hidden="true" /> : null}
        <span className="font-medium">{label}</span>
        {preview ? <span className="text-muted-foreground truncate">{preview}</span> : null}
        {duration ? <span className="text-muted-foreground/70 shrink-0 text-[11px]">{duration}</span> : null}
        {expandable ? (
          <ChevronDown
            className="text-muted-foreground/70 ml-auto size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90"
            aria-hidden="true"
          />
        ) : null}
      </button>
    </CollapsibleTrigger>
  );
}

export function CodeChatToolContent({ className, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent className={cn("border-t", className)} {...props} />;
}

export function CodeChatToolOutput({ className, ...props }: ComponentProps<"pre">) {
  return (
    <pre
      data-slot="code-chat-tool-output"
      className={cn("text-muted-foreground max-h-80 overflow-y-auto px-3 py-2 font-mono whitespace-pre-wrap", className)}
      {...props}
    />
  );
}

export function CodeChatToolDiff({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-tool-diff" className={cn("max-h-80 overflow-auto", className)} {...props} />;
}

type CodeChatToolChipProps = ComponentProps<"div"> & {
  icon?: ReactNode;
  label: string;
  detail?: string;
};

export function CodeChatToolChip({ icon, label, detail, className, ...props }: CodeChatToolChipProps) {
  return (
    <div
      data-slot="code-chat-tool-chip"
      className={cn("bg-muted/60 flex items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-xs", className)}
      {...props}
    >
      {icon ? <span className="text-lavender-400 shrink-0 [&_svg:not([class*='size-'])]:size-3">{icon}</span> : null}
      <span className="font-medium">{label}</span>
      {detail ? <span className="text-muted-foreground truncate">{detail}</span> : null}
    </div>
  );
}

type CodeChatToolNoteProps = ComponentProps<"div"> & {
  icon?: ReactNode;
};

export function CodeChatToolNote({ icon, className, children, ...props }: CodeChatToolNoteProps) {
  return (
    <div
      data-slot="code-chat-tool-note"
      className={cn("text-info mb-2 flex items-center gap-2 font-mono text-xs [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {icon}
      {children}
    </div>
  );
}
