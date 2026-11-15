import { useCallback, useRef, useState } from "react";
import type { Point, Rect } from "../lib/geometry";

export interface Viewport {
  x: number; // world coord at the top-left of the screen
  y: number;
  zoom: number; // screen px per world px
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.5;

/**
 * Business hook: pan/zoom state. `x/y` are the world coordinates shown at the
 * top-left corner; world→screen is `(w - v) * zoom`. Wheel pans (Miro-style),
 * ctrl/cmd+wheel zooms to the cursor.
 */
export function useViewport() {
  const [view, setView] = useState<Viewport>({ x: -200, y: -120, zoom: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef({ width: 1200, height: 800 });

  const set = useCallback((v: Viewport) => {
    viewRef.current = v;
    setView(v);
  }, []);

  const toWorld = useCallback((screen: Point): Point => {
    const v = viewRef.current;
    return { x: screen.x / v.zoom + v.x, y: screen.y / v.zoom + v.y };
  }, []);

  const panBy = useCallback(
    (dxScreen: number, dyScreen: number) => {
      const v = viewRef.current;
      set({ ...v, x: v.x - dxScreen / v.zoom, y: v.y - dyScreen / v.zoom });
    },
    [set],
  );

  const zoomAt = useCallback(
    (screen: Point, factor: number) => {
      const v = viewRef.current;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const world = { x: screen.x / v.zoom + v.x, y: screen.y / v.zoom + v.y };
      set({ x: world.x - screen.x / zoom, y: world.y - screen.y / zoom, zoom });
    },
    [set],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const rect = e.currentTarget.getBoundingClientRect();
        zoomAt({ x: e.clientX - rect.left, y: e.clientY - rect.top }, Math.exp(-e.deltaY * 0.0018));
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    },
    [panBy, zoomAt],
  );

  const fitView = useCallback(
    (bounds: Rect | null, padding = 80) => {
      const { width, height } = sizeRef.current;
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        set({ x: -width / 2, y: -height / 2, zoom: 1 });
        return;
      }
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((width - padding * 2) / bounds.width, (height - padding * 2) / bounds.height)));
      set({
        x: bounds.x + bounds.width / 2 - width / zoom / 2,
        y: bounds.y + bounds.height / 2 - height / zoom / 2,
        zoom,
      });
    },
    [set],
  );

  return { view, viewRef, sizeRef, set, toWorld, panBy, zoomAt, onWheel, fitView };
}
