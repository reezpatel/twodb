import { useCallback, useState } from "react";
import { useLargeViewport } from "@twodb/blocks";

/**
 * Business hook: right-docked detail panel visibility, viewport-aware.
 *
 * - lg+ (docked): always open — it's the page's detail view.
 * - below lg (overlay sheet): starts closed, toggled from the header
 *   "Details" button; closes on backdrop/Escape via Sidebar's onOpenChange.
 */
export function useDetailPanel() {
  const isLarge = useLargeViewport();
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = isLarge ? true : sheetOpen;
  const toggle = useCallback(() => setSheetOpen((o) => !o), []);

  return { open, setOpen: setSheetOpen, toggle, /** True when the panel floats as an overlay sheet (below lg). */ overlay: !isLarge };
}
