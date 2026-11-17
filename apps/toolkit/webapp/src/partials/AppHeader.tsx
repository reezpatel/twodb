import type { ReactNode } from "react";

/** Page title (+ optional subtitle) with right-aligned actions; labels collapse to icons via the caller on small screens. */
export function AppHeader({ title, subtitle, actions, status }: { title: string; subtitle?: string; actions?: ReactNode; status?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-none text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 truncate font-mono text-[11px] leading-none text-ink-muted">{subtitle}</p> : null}
      </div>
      {status ? <span className="hidden text-[11px] text-ink-muted sm:inline">{status}</span> : null}
      {actions}
    </div>
  );
}
