import * as React from "react";
import { Brain, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ThinkingBlockProps extends React.ComponentProps<"div"> {
  /** The thinking text. If omitted and `live` is true, shows an animated placeholder. */
  children?: React.ReactNode;
  /** Whether the model is still streaming its thinking (shows a pulsing dot). */
  live?: boolean;
  /** Start expanded. */
  defaultOpen?: boolean;
}

/** A collapsible "thinking…" block — the model's chain-of-thought, folded by default. */
function ThinkingBlock({ children, live = false, defaultOpen = false, className, ...props }: ThinkingBlockProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div data-slot="thinking-block" className={cn("overflow-hidden rounded-[10px] border border-outline bg-stone", className)} {...props}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2"
      >
        <Brain className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <span className="font-sans text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Thinking</span>
        {live ? <span className="size-1.5 animate-pulse rounded-full bg-ion-deep" /> : null}
        <ChevronRight className={cn("ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} strokeWidth={2} />
      </button>
      {open ? (
        <div className="border-t border-outline px-3 py-2">
          <div className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {children ?? (live ? <span className="animate-pulse">…</span> : null)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { ThinkingBlock };
