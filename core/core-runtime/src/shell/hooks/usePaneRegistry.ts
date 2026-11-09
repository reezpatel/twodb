import { useMemo } from "react";
import type { PaneDefinition } from "../types.js";

/** Business hook: indexes an app's pane definitions by type for O(1) lookup. */
export function usePaneRegistry(definitions: PaneDefinition<any>[]) {
  return useMemo(() => {
    const byType = new Map<string, PaneDefinition<any>>();
    for (const def of definitions) byType.set(def.type, def);
    return {
      get(type: string): PaneDefinition<any> | undefined {
        return byType.get(type);
      },
      has(type: string): boolean {
        return byType.has(type);
      },
    };
  }, [definitions]);
}
