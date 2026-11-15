import type { ReactNode } from "react";

/** The panel that pops out to the right of the tool dock. */
export function DockFlyout(props: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <div
      className={`pa-flyout max-h-[70vh] overflow-auto rounded-xl border border-outline bg-popover p-2 shadow-xl ${props.wide ? "w-72" : "w-56"}`}
      role="dialog"
      aria-label={props.title}
    >
      <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{props.title}</div>
      {props.children}
    </div>
  );
}
