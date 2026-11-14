import { useCallback, useEffect, useRef, useState } from "react";

/** A drag-resizable panel height (for bottom splits), clamped, persisted. */
export function useResizableHeight(key: string, initial: number, min = 120, max = 600) {
  const [height, setHeight] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= min && n <= max) return n;
      }
    } catch { /* ignore */ }
    return initial;
  });
  const dragging = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(key, String(height)); } catch { /* ignore */ }
  }, [key, height]);

  const start = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    const startY = e.clientY;
    const startH = height;
    const move = (ev: PointerEvent) => {
      if (!dragging.current) return;
      // bottom split: dragging up grows the panel
      setHeight(Math.min(max, Math.max(min, startH + (startY - ev.clientY))));
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [height, min, max]);

  const Handle = useCallback(() => (
    <div
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={start}
      className="group relative z-20 h-2 w-full shrink-0 cursor-row-resize touch-none"
      style={{ marginTop: -4, marginBottom: -4 }}
    >
      <div className="absolute inset-x-0 top-1/2 h-2 w-full -translate-y-1/2" />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-outline transition-colors group-hover:bg-ion-deep group-active:bg-ion-deep" />
    </div>
  ), [start]);

  return { height, setHeight, Handle };
}
