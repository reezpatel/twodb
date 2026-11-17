import { useCallback, useState } from "react";

/** Nav ids: "connectors" | "mcp" | "twodb" | "instance:<id>" | "mcp:<id>". Persisted so a reload returns to the same page. */
const KEY = "toolkit.view";

export type ToolkitView = { page: "connectors" | "mcp" | "twodb"; id: string | null };

function parse(id: string): ToolkitView {
  if (id.startsWith("instance:")) return { page: "connectors", id: id.slice("instance:".length) };
  if (id.startsWith("mcp:")) return { page: "mcp", id: id.slice("mcp:".length) };
  return { page: id === "mcp" || id === "twodb" ? id : "connectors", id: null };
}

/** Business hook: which page/selection is showing, derived from one nav id (sidebar `activeId` and `onSelect` speak the same ids). */
export function useToolkitNav() {
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) || "connectors";
    } catch {
      return "connectors";
    }
  });

  const select = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // persistence is best-effort
    }
  }, []);

  return { activeId, view: parse(activeId), select };
}
