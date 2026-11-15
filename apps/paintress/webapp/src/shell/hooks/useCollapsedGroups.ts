import { useCallback, useState } from "react";

const KEY = "paintress.sidebar.collapsed";

/** Business hook: which sidebar group sections are collapsed (persisted). */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {
      return {};
    }
  });
  const toggle = useCallback(
    (id: string) =>
      setCollapsed((c) => {
        const next = { ...c, [id]: !c[id] };
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      }),
    [],
  );
  return { collapsed, toggle };
}
