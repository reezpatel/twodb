import type { ReactNode } from "react";
import { cn } from "@twodb/blocks";
import { APP_COLUMNS } from "./AppRow.js";

/** Dumb/presentational — one titled group of app rows inside a single bordered surface. */
export function AppsTable({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="mt-2 first:mt-0">
      <h3 className="mb-2.5 text-[13px] font-semibold text-ink">
        {title} <span className="ml-1 font-normal text-ink-muted">{count}</span>
      </h3>
      <div className="overflow-hidden rounded-xl border border-outline bg-card shadow-[0_1px_2px_rgba(0,0,0,.025)]">
        <div
          aria-hidden
          className={cn(
            "hidden items-center gap-x-4 border-b border-outline bg-stone/70 px-4 py-2.5 text-[10px] font-medium tracking-[0.09em] text-ink-muted uppercase sm:grid",
            APP_COLUMNS,
          )}
        >
          <span>App</span>
          <span>Status</span>
          <span>Mode</span>
          <span>Version</span>
          <span />
        </div>
        <div className="divide-y divide-outline">{children}</div>
      </div>
    </section>
  );
}
