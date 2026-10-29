import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCodeChatToolsOpen } from "./code-chat-tools-open";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type CodeChatToolProps = ComponentProps<typeof Collapsible> & {
  failed?: boolean;
};

export function CodeChatTool({ failed = false, className, open: openProp, defaultOpen, onOpenChange, ...props }: CodeChatToolProps) {
  const globalOpen = useCodeChatToolsOpen();
  const [local, setLocal] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setLocal(undefined);
  }, [globalOpen]);

  const open = openProp ?? local ?? globalOpen ?? defaultOpen ?? false;

  return (
    <Collapsible
      data-slot="code-chat-tool"
      data-failed={failed || undefined}
      open={open}
      onOpenChange={(next) => {
        setLocal(next);
        onOpenChange?.(next);
      }}
      className={cn("rounded-sm text-sm", failed ? "bg-destructive/10" : "bg-muted/60", className)}
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
          "group hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent",
          className,
        )}
        {...props}
      >
        {running ? <Loader2 className="text-primary size-3 animate-spin" aria-hidden="true" /> : null}
        <span className="font-medium">{label}</span>
        {preview ? <span className="text-muted-foreground truncate font-mono text-xs">{preview}</span> : null}
        {duration ? <span className="text-muted-foreground/70 shrink-0 text-[13px]">{duration}</span> : null}
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
      className={cn("text-muted-foreground max-h-80 overflow-y-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap", className)}
      {...props}
    />
  );
}

export function CodeChatToolDiff({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-chat-tool-diff" className={cn("max-h-80 overflow-auto text-xs", className)} {...props} />;
}

type CodeChatToolChipProps = ComponentProps<"div"> & {
  icon?: ReactNode;
  label: string;
  detail?: string;
};

export function CodeChatToolChip({ icon, label, detail, className, ...props }: CodeChatToolChipProps) {
  return (
    <div data-slot="code-chat-tool-chip" className={cn("bg-muted/60 flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm", className)} {...props}>
      {icon ? <span className="text-lavender-400 shrink-0 [&_svg:not([class*='size-'])]:size-3">{icon}</span> : null}
      <span className="font-medium">{label}</span>
      {detail ? <span className="text-muted-foreground truncate font-mono text-xs">{detail}</span> : null}
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
      className={cn("text-info mb-2 flex items-center gap-2 text-sm [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      {icon}
      {children}
    </div>
  );
}
