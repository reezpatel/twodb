import { useCallback } from "react";
import { ulid } from "ulid";
import type { PaneDefinition, PaneStateStore } from "../types.js";
import { usePaneRegistry } from "./usePaneRegistry.js";
import { usePaneState } from "./usePaneState.js";

export interface UseShellOptions {
  definitions: PaneDefinition<any>[];
  store: PaneStateStore;
}

/**
 * The "holding" hook that backs the <Shell /> component. Composes the
 * smaller business hooks (registry lookup + persisted state) and is the
 * only thing <Shell /> calls — it gets panes/activePane/handlers back and
 * renders dumb partials with them.
 */
export function useShell(options: UseShellOptions) {
  const registry = usePaneRegistry(options.definitions);
  const { state, setState, loaded } = usePaneState(options.store);

  const openPane = useCallback(
    (type: string, params: Record<string, unknown>) => {
      const def = registry.get(type);
      if (!def) throw new Error(`useShell: unknown pane type "${type}"`);
      const id = ulid();
      const title = def.title(params);
      setState((prev) => ({
        panes: [...prev.panes, { id, type, params, title }],
        activePaneId: id,
      }));
      return id;
    },
    [registry, setState],
  );

  const closePane = useCallback(
    (id: string) => {
      setState((prev) => {
        const panes = prev.panes.filter((p) => p.id !== id);
        const activePaneId =
          prev.activePaneId === id ? (panes[panes.length - 1]?.id ?? null) : prev.activePaneId;
        return { panes, activePaneId };
      });
    },
    [setState],
  );

  const setActivePane = useCallback(
    (id: string) => {
      setState((prev) => (prev.panes.some((p) => p.id === id) ? { ...prev, activePaneId: id } : prev));
    },
    [setState],
  );

  const activePane = state.panes.find((p) => p.id === state.activePaneId) ?? null;
  const activeDefinition = activePane ? registry.get(activePane.type) : undefined;

  return {
    loaded,
    panes: state.panes,
    activePane,
    activeDefinition,
    openPane,
    closePane,
    setActivePane,
  };
}
