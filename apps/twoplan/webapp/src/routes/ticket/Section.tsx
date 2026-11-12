import type { ReactNode } from "react";

export function Section({ title, count, action, children }: { title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2"><h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>{count ? <span className="text-xs text-ink-muted">{count}</span> : null}<span className="ml-auto">{action}</span></div>
      {children}
    </section>
  );
}
export const addBtn = "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-ink-muted hover:bg-paper-grid hover:text-ink";
