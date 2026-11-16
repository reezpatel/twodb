import { useCallback, useState } from "react";
import { useLargeViewport } from "@twodb/blocks";

/**
 * Business hook: nav visibility, viewport-aware.
 *
 * - lg+ (docked): the preference is remembered across reloads (per app,
 *   localStorage key).
 * - below lg (overlay sheet): ephemeral, starts closed, never persisted —
 *   a phone session must not clobber the desktop preference.
 */
export function useSidebarToggle(storageKey: string) {
  const isLarge = useLargeViewport();
  const [dockedOpen, setDockedOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "false";
    } catch {
      return true;
    }
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = isLarge ? dockedOpen : sheetOpen;

  const setOpen = useCallback(
    (next: boolean | ((o: boolean) => boolean)) => {
      const resolve = (o: boolean) => (typeof next === "function" ? next(o) : next);
      if (isLarge) {
        setDockedOpen((o) => {
          const value = resolve(o);
          try {
            localStorage.setItem(storageKey, String(value));
          } catch {
            // persistence is best-effort
          }
          return value;
        });
      } else {
        setSheetOpen((o) => resolve(o));
      }
    },
    [isLarge, storageKey],
  );

  const toggle = useCallback(() => setOpen((o) => !o), [setOpen]);

  return { open, toggle, setOpen, /** True when the nav floats as an overlay sheet (below lg). */ overlay: !isLarge };
}
