import { useCallback, useState } from "react";

/** Business hook: nav visibility, remembered across reloads (per app, localStorage key). */
export function useSidebarToggle(storageKey: string) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "false";
    } catch {
      return true;
    }
  });
  const toggle = useCallback(() => {
    setOpen((o) => {
      try {
        localStorage.setItem(storageKey, String(!o));
      } catch {
        // persistence is best-effort
      }
      return !o;
    });
  }, [storageKey]);
  return { open, toggle };
}
