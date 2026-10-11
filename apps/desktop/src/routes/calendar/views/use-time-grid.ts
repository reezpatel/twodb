import { useEffect, useRef, useState } from "react";
import type { Occurrence } from "../calendar-api";
import type { TimedBlock } from "./layout";

export const HOUR_PX = 48;
const SNAP = 15;
const DRAG_THRESHOLD_PX = 4;

export type GridDrag =
  | { kind: "create"; dayIndex: number; startMin: number; endMin: number }
  | { kind: "move"; block: TimedBlock; dayDelta: number; minDelta: number }
  | { kind: "resize"; block: TimedBlock; endMin: number };

interface Handlers {
  days: string[];
  canEdit: (o: Occurrence) => boolean;
  onCreate: (day: string, startMin: number, endMin: number) => void;
  onSelect: (o: Occurrence) => void;
  onMove: (block: TimedBlock, dayDelta: number, minDelta: number) => void;
  onResize: (block: TimedBlock, endMin: number) => void;
}

const snap = (m: number) => Math.round(m / SNAP) * SNAP;

/** Pointer interactions on the time grid. Clicks select, drags create / move / resize in 15-minute steps. */
export function useTimeGrid(h: Handlers) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDragState] = useState<GridDrag | null>(null);
  const dragRef = useRef<GridDrag | null>(null);
  const setDrag = (next: GridDrag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const origin = useRef<{ x: number; y: number; moved: boolean; dayIndex: number; minute: number } | null>(null);
  const handlersRef = useRef(h);
  handlersRef.current = h;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7.5 * HOUR_PX });
  }, []);

  const locate = (clientX: number, clientY: number) => {
    const rect = columnsRef.current!.getBoundingClientRect();
    const n = handlersRef.current.days.length;
    const dayIndex = Math.min(n - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * n)));
    const minute = Math.min(24 * 60, Math.max(0, ((clientY - rect.top) / HOUR_PX) * 60));
    return { dayIndex, minute };
  };

  const begin = (e: React.PointerEvent, next: (pos: { dayIndex: number; minute: number }) => GridDrag | null) => {
    if (e.button !== 0) return;
    const pos = locate(e.clientX, e.clientY);
    origin.current = { x: e.clientX, y: e.clientY, moved: false, ...pos };
    const initial = next(pos);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const o = origin.current!;
      if (!o.moved && Math.hypot(ev.clientX - o.x, ev.clientY - o.y) < DRAG_THRESHOLD_PX) return;
      o.moved = true;
      const p = locate(ev.clientX, ev.clientY);
      const base = dragRef.current ?? initial;
      if (!base) return;
      if (base.kind === "create") {
        const a = snap(o.minute);
        const b = snap(p.minute);
        setDrag({ ...base, startMin: Math.min(a, b), endMin: Math.max(Math.max(a, b), Math.min(a, b) + SNAP) });
      } else if (base.kind === "move") setDrag({ ...base, dayDelta: p.dayIndex - o.dayIndex, minDelta: snap(p.minute - o.minute) });
      else setDrag({ ...base, endMin: Math.max(base.block.startMin + SNAP, snap(p.minute)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const o = origin.current!;
      const hd = handlersRef.current;
      const final = dragRef.current ?? initial;
      setDrag(null);
      origin.current = null;
      if (final?.kind === "create") {
        if (o.moved) hd.onCreate(hd.days[final.dayIndex], final.startMin, final.endMin);
        else {
          const start = Math.floor(o.minute / 30) * 30;
          hd.onCreate(hd.days[final.dayIndex], start, start + 60);
        }
      } else if (final?.kind === "move") {
        if (!o.moved) hd.onSelect(final.block.occurrence);
        else if (final.dayDelta || final.minDelta) hd.onMove(final.block, final.dayDelta, final.minDelta);
      } else if (final?.kind === "resize" && o.moved && final.endMin !== final.block.endMin) hd.onResize(final.block, final.endMin);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return {
    columnsRef,
    scrollRef,
    drag,
    onColumnPointerDown: (e: React.PointerEvent) =>
      begin(e, (p) => ({ kind: "create", dayIndex: p.dayIndex, startMin: snap(p.minute), endMin: snap(p.minute) + 30 })),
    onBlockPointerDown: (e: React.PointerEvent, block: TimedBlock) => {
      e.stopPropagation();
      if (!handlersRef.current.canEdit(block.occurrence)) {
        if (e.button === 0) handlersRef.current.onSelect(block.occurrence);
        return;
      }
      begin(e, () => ({ kind: "move", block, dayDelta: 0, minDelta: 0 }));
    },
    onResizePointerDown: (e: React.PointerEvent, block: TimedBlock) => {
      e.stopPropagation();
      begin(e, () => ({ kind: "resize", block, endMin: block.endMin }));
    },
  };
}
