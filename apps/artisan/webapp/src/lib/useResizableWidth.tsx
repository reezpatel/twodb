import { useCallback, useEffect, useRef, useState } from "react";

/** A drag-resizable panel width, clamped to [min,max], persisted to localStorage. */
export function useResizableWidth(key: string, initial: number, min = 160, max = 560) {
  const [width, setWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= min && n <= max) return n;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });
  const dragging = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(key, String(width));
    } catch {
      /* ignore */
    }
  }, [key, width]);

  const start = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      const startX = e.clientX;
      const startW = width;
      const dir = key.includes("right") ? -1 : 1; // right sidebar grows leftward
      const move = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const next = startW + dir * (ev.clientX - startX);
        setWidth(Math.min(max, Math.max(min, next)));
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
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [key, width, min, max],
  );

  /** A thin drag handle rendered at the panel edge. */
  const Handle = useCallback(
    ({ edge }: { edge: "left" | "right" }) => (
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={start}
        className={`group relative z-10 w-1 shrink-0 cursor-col-resize ${
          edge === "right" ? "order-last" : "order-first"
        }`}
        style={{ marginLeft: edge === "right" ? -2 : 0, marginRight: edge === "left" ? -2 : 0 }}
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-ion-deep group-active:bg-ion-deep" />
      </div>
    ),
    [start],
  );

  return { width, setWidth, Handle };
}
