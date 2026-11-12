import { useCallback, useState } from "react";

/** Tab state: one tab per open session; active tab renders its chat view.
 *  Tabs persist across navigation; closing = leave room only. */
export interface SessionTab {
  sessionId: string;
  label: string;
}

export function useTabs() {
  const [tabs, setTabs] = useState<SessionTab[]>([]);
  const [active, setActive] = useState<string | null>(null);

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

  return { tabs, active, open, close, rename, setActive };
}
