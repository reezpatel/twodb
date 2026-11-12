import type { ReactNode } from "react";

export function ToolbarButton(props: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`inline-flex size-7 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-paper-grid hover:text-ink disabled:opacity-40 ${props.active ? "bg-paper-grid text-ink" : ""}`}
    >
      {props.children}
    </button>
  );
}

export const ToolbarSeparator = () => <span className="mx-1 h-4 w-px bg-outline" />;
