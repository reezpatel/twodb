import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Point } from "../lib/geometry";

/**
 * HTML-in-SVG: node components render plain SVG, but inline editors (textareas,
 * row inputs, add-column buttons) are HTML. They register world-anchored
 * elements here; the canvas overlays them on the SVG, scaled to the viewport.
 */
export interface Overlay {
  at: Point; // world-space top-left
  width: number; // world units (zoom scales it)
  height?: number;
  el: ReactNode;
}

export interface OverlayApi {
  set(id: string, overlay: Overlay | null): void;
}

export const OverlayContext = createContext<OverlayApi>({ set: () => undefined });

export function useOverlayHost(): { overlays: Map<string, Overlay>; api: OverlayApi } {
  const [overlays, setOverlays] = useState<Map<string, Overlay>>(new Map());
  const set = useCallback((id: string, overlay: Overlay | null) => {
    setOverlays((m) => {
      const had = m.get(id);
      if (!overlay && !had) return m;
      if (overlay && had && had.at.x === overlay.at.x && had.at.y === overlay.at.y && had.width === overlay.width && had.height === overlay.height && had.el === overlay.el) return m;
      const next = new Map(m);
      if (overlay) next.set(id, overlay);
      else next.delete(id);
      return next;
    });
  }, []);
  return { overlays, api: { set } };
}

/** Register an overlay; null removes it. `deps` should cover everything in `make`. */
export function useOverlay(id: string, make: () => Overlay | null, deps: readonly unknown[]): void {
  const api = useContext(OverlayContext);
  const overlay = useMemo(make, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.set(id, overlay);
    return () => api.set(id, null);
  }, [api, id, overlay]);
}
