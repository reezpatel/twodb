import type { PaneDefinition, PaneInstance } from "../types.js";

export interface ShellPaneHostProps {
  pane: PaneInstance | null;
  definition: PaneDefinition<any> | undefined;
}

/** Dumb/presentational only — renders whichever pane component is active. */
export function ShellPaneHost(props: ShellPaneHostProps) {
  if (!props.pane) {
    return <div className="twodb-shell-empty">No pane open.</div>;
  }
  if (!props.definition) {
    return <div className="twodb-shell-empty">Unknown pane type: {props.pane.type}</div>;
  }
  const PaneComponent = props.definition.component;
  return <PaneComponent params={props.pane.params} paneId={props.pane.id} />;
}
