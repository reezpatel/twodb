import { PanelLeftOpen, Plus, Shapes } from "lucide-react";

/** Home screen when no board is open. */
export function Welcome(props: { onNew(): void; sidebar?: { open: boolean; onToggle(): void } }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      {props.sidebar && !props.sidebar.open && (
        <button
          type="button"
          aria-label="Show sidebar"
          title="Show sidebar (Ctrl+B)"
          onClick={props.sidebar.onToggle}
          className="absolute left-3 top-3 rounded-full p-1.5 text-ink-muted hover:bg-paper-grid"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        <Shapes className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium tracking-wide text-ink">Paintress</p>
        <p className="max-w-md text-sm leading-relaxed text-ink-muted">
          Diagrams and markdown docs that you and your agents edit together, live. Pick a board from the sidebar, or create a new one.
        </p>
      </div>
      <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-outline px-3 py-1.5 text-[13px] hover:bg-surface-muted" onClick={props.onNew}>
        <Plus className="size-4" /> New board
      </button>
    </div>
  );
}
