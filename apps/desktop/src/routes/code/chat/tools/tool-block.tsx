import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { DiffView } from "../screens/diff-view";
import { ToolDuration } from "@/components/thinking-block";
import { cn } from "@/lib/utils";

/** Everything a tool view can know about one call — live or committed. */
export interface ToolViewProps {
  name: string;
  /** Call arguments. Absent for orphan tool rows (result with no matching call). */
  args?: Record<string, unknown>;
  output?: string;
  diff?: string;
  running?: boolean;
  startedAt?: number;
  completedAt?: number;
  failed?: boolean;
  /** Global Ctrl+O "tool outputs open" state. */
  defaultOpen?: boolean;
}

/** Common arg keys used as the one-line header preview, in priority order. */
const PREVIEW_KEYS = ["command", "path", "pattern", "url", "query"] as const;

export function defaultPreview(args?: Record<string, unknown>): string | undefined {
  for (const key of PREVIEW_KEYS) {
    const v = args?.[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

/**
 * Generic collapsible tool block — the catch-all view for any tool without a
 * custom entry in TOOL_VIEWS. `label` replaces the tool name in the header and
 * `preview` replaces the default arg preview.
 */
export function ToolBlock({
  name,
  args,
  output,
  diff,
  running,
  startedAt,
  completedAt,
  failed,
  defaultOpen,
  label,
  preview,
}: ToolViewProps & { label?: string; preview?: string }) {
  const [expanded, setExpanded] = useState(false);
  // The global Ctrl+O flip overrides individual blocks; diff-bearing blocks
  // show their body until collapsed — the diff IS the result.
  const [overridden, setOverridden] = useState(false);
  useEffect(() => {
    setExpanded(defaultOpen ?? false);
    setOverridden(false);
  }, [defaultOpen]);
  const hasDiff = !!diff && diff.trim().length > 0;
  const hasOutput = output !== undefined && output !== "";
  const showBody = overridden ? expanded : (defaultOpen ?? false) || hasDiff;
  const headerPreview = preview ?? defaultPreview(args);

  return (
    <div className={cn("rounded-lg border text-xs", failed ? "bg-destructive/10 border-destructive/40" : "bg-muted/60")}>
      <button
        className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono"
        onClick={() => {
          setExpanded((v) => !v);
          setOverridden(true);
        }}
      >
        {running ? <Loader2 size={12} className="text-primary animate-spin" aria-hidden="true" /> : null}
        <span className="font-medium">{label ?? name}</span>
        {headerPreview && <span className="text-muted-foreground truncate">{headerPreview}</span>}
        <ToolDuration startedAt={startedAt} completedAt={completedAt} />
        {(hasOutput || hasDiff) && (
          <ChevronDown
            size={12}
            className={cn("text-muted-foreground/70 ml-auto shrink-0 transition-transform", !showBody && "-rotate-90")}
            aria-hidden="true"
          />
        )}
      </button>
      {showBody && hasDiff && (
        <div className="max-h-80 overflow-auto border-t">
          <DiffView text={diff!} />
        </div>
      )}
      {showBody && hasOutput && <pre className="text-muted-foreground max-h-80 overflow-y-auto border-t px-3 py-2 whitespace-pre-wrap">{output}</pre>}
    </div>
  );
}
