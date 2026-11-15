import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/** One button in the left tool dock. `flyout` shows the open-chevron affordance. */
export function DockButton(props: { title: string; active?: boolean; flyout?: boolean; open?: boolean; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      aria-expanded={props.flyout ? !!props.open : undefined}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`relative flex size-9 items-center justify-center rounded-lg transition-colors ${
        props.active || props.open ? "bg-ink text-paper" : "text-ink hover:bg-paper-grid"
      } disabled:opacity-35`}
    >
      {props.children}
      {props.flyout && <ChevronRight className={`absolute -right-0.5 bottom-0 size-2.5 ${props.active || props.open ? "text-paper" : "text-ink-muted"}`} />}
    </button>
  );
}
