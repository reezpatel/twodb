import { cn } from "@twodb/blocks";
import type { AppState } from "../../../lib/app-state.js";

const DOT: Record<AppState["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-ink-muted/40",
};

/** Dumb/presentational — a status dot plus its words (color is never the only signal). */
export function AppStateDot({ state }: { state: AppState }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-ink">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[state.tone], state.pulse && "animate-pulse")} />
      {state.label}
    </span>
  );
}
