import { useCallback, useEffect, useState } from "react";
import { readJson, writeJson } from "../../../lib/persist.js";

/** Tab state: one tab per open session; active tab renders its chat view.
 *  Tabs persist across navigation; closing = leave room only. */
export interface SessionTab {
  sessionId: string;
  label: string;
}

const TABS_KEY = "artisan.tabs";
interface SavedTabs {
  tabs: SessionTab[];
  active: string | null;
}

/** Open session tabs + the active one are global and survive a reload. */
export function useTabs() {
  const [restored] = useState(() => {
    const s = readJson<SavedTabs>(TABS_KEY, { tabs: [], active: null });
    const tabs = Array.isArray(s.tabs) ? s.tabs.filter((t) => t && typeof t.sessionId === "string") : [];
    return { tabs, active: tabs.some((t) => t.sessionId === s.active) ? s.active : null };
  });
  const [tabs, setTabs] = useState<SessionTab[]>(restored.tabs);
  const [active, setActive] = useState<string | null>(restored.active);

  useEffect(() => {
    writeJson(TABS_KEY, { tabs, active });
  }, [tabs, active]);

  /** Drop restored tabs whose session no longer exists. */
  const prune = useCallback((validIds: Set<string>) => {
    setTabs((prev) => {
      const next = prev.filter((t) => validIds.has(t.sessionId));
      return next.length === prev.length ? prev : next;
    });
    setActive((cur) => (cur && !validIds.has(cur) ? null : cur));
  }, []);

  const open = useCallback((sessionId: string, label?: string) => {
    setTabs((prev) => {
      if (prev.some((t) => t.sessionId === sessionId)) return prev;
      return [...prev, { sessionId, label: label ?? `session-${sessionId.slice(-4)}` }];
    });
    setActive(sessionId);
  }, []);

  const rename = useCallback((sessionId: string, label: string) => {
    setTabs((prev) => prev.map((t) => (t.sessionId === sessionId ? { ...t, label } : t)));
  }, []);

  const close = useCallback((sessionId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.sessionId === sessionId);
      const next = prev.filter((t) => t.sessionId !== sessionId);
      setActive((cur) => {
        if (cur !== sessionId) return cur;
        return next[Math.min(idx, next.length - 1)]?.sessionId ?? null;
      });
      return next;
    });
  }, []);

  return { tabs, active, open, close, rename, setActive, prune };
}
