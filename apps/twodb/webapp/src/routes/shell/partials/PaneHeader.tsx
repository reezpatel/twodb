import type { ReactNode } from "react";

/** Dumb/presentational — the title block every pane starts with (title, subtitle, optional action). */
export function PaneHeader({ title = "", description = "", action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-5">
      <div>
        <h2 className="text-base font-medium tracking-[-0.025em] text-ink">{title}</h2>
        <p className="text-sm leading-5 text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
