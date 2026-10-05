import { Eraser } from "lucide-react";

export interface ClearBlockMeta {
  clearedMessages?: number;
}

/**
 * Renders a persisted clear: a hard context cutoff. Everything above this
 * divider stays in the transcript but is never sent to the model again —
 * like compaction, minus the summary.
 */
export function ClearBlock({ meta }: { meta: ClearBlockMeta | null }) {
  return (
    <div className="text-muted-foreground/80 flex items-center gap-3 py-1" role="separator" aria-label="Context cleared">
      <span className="bg-border h-px flex-1" aria-hidden="true" />
      <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wide uppercase">
        <Eraser size={11} aria-hidden="true" />
        cleared
        {typeof meta?.clearedMessages === "number" && meta.clearedMessages > 0 ? ` — ${meta.clearedMessages} messages dropped from context` : ""}
      </span>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
    </div>
  );
}
