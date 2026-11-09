import { useShell } from "./hooks/useShell.js";
import { ShellTabsBar } from "./partials/ShellTabsBar.js";
import { ShellPaneHost } from "./partials/ShellPaneHost.js";
import type { PaneDefinition, PaneStateStore } from "./types.js";

export interface ShellProps {
  definitions: PaneDefinition<any>[];
  store: PaneStateStore;
}

/**
 * The tabs/panes runtime every B+W app's frontend is built on top of. This
 * component only calls its one holding hook (`useShell`) and renders
 * partials — it holds no logic itself, per the partials/hooks convention.
 */
export function Shell(props: ShellProps) {
  const shell = useShell({ definitions: props.definitions, store: props.store });

  if (!shell.loaded) {
    return <div className="twodb-shell-loading">Loading…</div>;
  }

  return (
    <div className="twodb-shell">
      <ShellTabsBar
        panes={shell.panes}
        activePaneId={shell.activePane?.id ?? null}
        onSelect={shell.setActivePane}
        onClose={shell.closePane}
      />
      <ShellPaneHost pane={shell.activePane} definition={shell.activeDefinition} />
    </div>
  );
}

export { useShell } from "./hooks/useShell.js";
