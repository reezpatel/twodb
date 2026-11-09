import type { PaneStateStore, ShellState } from "../types.js";

export interface ApiPaneStoreOptions {
  /** Loads this user's saved shell state from the owning app's own endpoint. */
  load(): Promise<ShellState>;
  /** Persists it back. Apps typically debounce calls to this themselves. */
  save(state: ShellState): Promise<void>;
}

/**
 * For apps that persist pane state in their own DB instead of localStorage
 * (per decision log — "panes will manage state in local storage or db,
 * depending on the app"). This is just a thin pass-through so the Shell
 * component's contract (`PaneStateStore`) is identical either way — the app
 * supplies the actual fetch calls to its own endpoints.
 */
export function createApiPaneStore(options: ApiPaneStoreOptions): PaneStateStore {
  return { load: options.load, save: options.save };
}
