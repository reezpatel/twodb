import type { PaneStateStore, ShellState } from "../types.js";

const EMPTY_STATE: ShellState = { panes: [], activePaneId: null };

export function createLocalStoragePaneStore(storageKey: string): PaneStateStore {
  return {
    async load() {
      if (typeof window === "undefined") return EMPTY_STATE;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return EMPTY_STATE;
      try {
        return JSON.parse(raw) as ShellState;
      } catch {
        return EMPTY_STATE;
      }
    },
    async save(state) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    },
  };
}
