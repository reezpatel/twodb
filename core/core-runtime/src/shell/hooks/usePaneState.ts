import { useEffect, useRef, useState } from "react";
import type { PaneStateStore, ShellState } from "../types.js";

const EMPTY_STATE: ShellState = { panes: [], activePaneId: null };

/**
 * Business hook: loads shell state from the given store on mount, and
 * persists it (debounced) whenever it changes. Pure state + persistence —
 * no rendering, no knowledge of pane components.
 */
export function usePaneState(store: PaneStateStore) {
  const [state, setState] = useState<ShellState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    store.load().then((loadedState) => {
      if (!cancelled) {
        setState(loadedState);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      store.save(state);
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, loaded]);

  return { state, setState, loaded };
}
