import type { ComponentType } from "react";

export interface PaneProps<P = Record<string, unknown>> {
  params: P;
  paneId: string;
}

export interface PaneDefinition<P = Record<string, unknown>> {
  /** Unique pane type within the app, e.g. "mail.thread", "mail.folder". */
  type: string;
  /** Derives a tab label from the pane's params, e.g. params => params.subject. */
  title: (params: P) => string;
  component: ComponentType<PaneProps<P>>;
  /** Optional icon name (lucide-react icon key) shown in the tab. */
  icon?: string;
}

export interface PaneInstance {
  id: string;
  type: string;
  params: Record<string, unknown>;
  title: string;
}

export interface ShellState {
  panes: PaneInstance[];
  activePaneId: string | null;
}

/**
 * Persistence contract every app's Shell is backed by: either localStorage
 * (per decision log: "panes manage state in local storage or db, depending
 * on the app") or a DB-backed adapter calling that app's own endpoints.
 */
export interface PaneStateStore {
  load(): Promise<ShellState>;
  save(state: ShellState): Promise<void>;
}
