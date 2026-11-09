import type { PaneInstance } from "../types.js";

export interface ShellTabsBarProps {
  panes: PaneInstance[];
  activePaneId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

/** Dumb/presentational only — no state, no fetching. Renders the tab strip. */
export function ShellTabsBar(props: ShellTabsBarProps) {
  return (
    <div className="twodb-shell-tabs" role="tablist">
      {props.panes.map((pane) => {
        const isActive = pane.id === props.activePaneId;
        return (
          <div
            key={pane.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive || undefined}
            className="twodb-shell-tab"
            onClick={() => props.onSelect(pane.id)}
          >
            <span className="twodb-shell-tab-title">{pane.title}</span>
            <button
              type="button"
              aria-label={`Close ${pane.title}`}
              className="twodb-shell-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                props.onClose(pane.id);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
