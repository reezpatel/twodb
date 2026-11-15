import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actorKind, type Board, type Item } from "@shared/model";
import { applyEvent, absPosition, type ItemMap } from "../../lib/item-store";
import { useBoardSocket } from "../../board/hooks/useBoardSocket";
import { useCanvasTheme } from "../../lib/canvas-theme";
import type { Rect } from "../../svg-canvas/lib/geometry";
import type { CanvasTool } from "../../svg-canvas/hooks/useInteractions";
import { sameSpec, type ArmedSpec } from "./usePlacement";
import { useAgentActivity } from "./useAgentActivity";
import { useDiagramCommands } from "./useDiagramCommands";
import { useHistory } from "./useHistory";
import { useShortcuts } from "./useShortcuts";
import { useToast } from "./useToast";

export type Tool = CanvasTool;

/** Holding hook for BoardDiagram: board state, live sync, selection, canvas commands. */
export function useBoardDiagram(boardId: string) {
  const [items, setItemsState] = useState<ItemMap>(new Map());
  const itemsRef = useRef<ItemMap>(items);
  const setItems = useCallback((fn: (m: ItemMap) => ItemMap) => {
    itemsRef.current = fn(itemsRef.current);
    setItemsState(itemsRef.current);
  }, []);
  const [board, setBoard] = useState<Board | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [presence, setPresence] = useState<{ actor: string; kind: "human" | "agent" }[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<string[]>([]);
  const [fitSignal, setFitSignal] = useState(0);
  const history = useHistory();
  const toast = useToast();
  const activity = useAgentActivity();
  const theme = useCanvasTheme();
  const clientRef = useRef("");
  const [armed, setArmed] = useState<ArmedSpec | null>(null);
  // Arming an item drops back to the select tool; picking a draw tool disarms.
  const arm = useCallback((spec: ArmedSpec) => {
    setTool("select");
    setArmed((cur) => (sameSpec(cur, spec) ? null : spec));
  }, []);
  const disarm = useCallback(() => setArmed(null), []);
  const setToolMode = useCallback((t: Tool) => {
    if (t !== "select") setArmed(null);
    setTool(t);
  }, []);

  const socket = useBoardSocket(boardId, {
    onSnapshot: (m) => {
      setItems(() => new Map(m.items.map((i) => [i.id, i])));
      setBoard(m.board);
      setLoaded(true);
      history.clear();
    },
    onEvents: ({ events }) => {
      for (const ev of events) {
        if (ev.origin === clientRef.current) continue;
        setItems((m) => applyEvent(m, ev));
        if (actorKind(ev.actor) === "agent") {
          history.record({ label: ev.label ?? "AI change", ops: ev.inverse });
          activity.flashIds(ev.upserts.map((i) => i.id));
          toast.notify(ev.label ?? "An agent changed the board");
        }
      }
    },
    onPresence: (m) => setPresence(m.actors),
    onError: (code, message) => toast.notify(`${code}: ${message}`),
  });
  clientRef.current = socket.clientId;
  const canEdit = socket.status === "open" && loaded;

  const cmd = useDiagramCommands({
    boardId,
    itemsRef,
    setItems,
    sendOps: socket.sendOps,
    history,
    canEdit,
    notify: toast.notify,
    resync: socket.resync,
    toFlow: (p) => p, // unused by the SVG canvas (it converts itself)
  });

  // Esc cancels an armed placement, else drops back to the select tool.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (armed) disarm();
      else if (tool !== "select") setTool("select");
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [armed, disarm, tool]);

  // Prune selection as items vanish (deleted by an agent, undo…).
  useEffect(() => {
    setSelection((sel) => {
      const kept = sel.filter((id) => items.has(id));
      return kept.length === sel.length ? sel : kept;
    });
  }, [items]);

  const selectedIds = selection;
  const selectedItem: Item | null = selectedIds.length === 1 ? (items.get(selectedIds[0]!) ?? null) : null;

  // ---- canvas gestures → commands -------------------------------------------

  const moveEnded = useCallback(
    (ids: string[], abs: Map<string, { x: number; y: number }>) => {
      // Mimic the old drag: build pseudo "nodes" with absolute positions.
      const m = itemsRef.current;
      const pseudo = ids.map((id) => {
        const item = m.get(id)!;
        const parent = item.parentId ? m.get(item.parentId) : undefined;
        const base = parent ? absPosition(m, parent) : { x: 0, y: 0 };
        const a = abs.get(id)!;
        return { id, position: { x: a.x - base.x, y: a.y - base.y } };
      });
      cmd.dragEnded(pseudo as never);
    },
    [cmd],
  );

  const resizeEnded = useCallback((id: string, rect: Rect) => cmd.resized(id, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }), [cmd]);

  const connect = useCallback(
    (fromId: string, fromHandle: string, toId: string | null, toHandle: string | null) => {
      if (!toId) return;
      cmd.connect({ source: fromId, target: toId, sourceHandle: fromHandle, targetHandle: toHandle } as never);
    },
    [cmd],
  );

  const createAt = useCallback(
    (rect: Rect | null, point: { x: number; y: number }) => {
      if (!armed) return;
      cmd.placeArmed(armed, rect, point);
      disarm();
    },
    [armed, cmd, disarm],
  );

  const drawEnded = useCallback(
    (points: { x: number; y: number }[], drawTool: "pen" | "highlighter") => {
      cmd.addDraw(points, drawTool, theme.shapeStroke);
    },
    [cmd, theme],
  );
  const eraseHit = useCallback((id: string) => cmd.deleteIds([id]), [cmd]);

  // palette drag-and-drop (HTML5) still works alongside click-to-arm
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/paintress");
      if (!raw) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const p = JSON.parse(raw) as { kind: string; pack?: string; shape?: string; style?: string; icon?: string; label?: string; color?: string };
      const place = (fn: (opts: { at: { x: number; y: number } }) => void) => fn({ at });
      if (p.kind === "shape") place((o) => cmd.addShape(p.pack!, p.shape!, o));
      else if (p.kind === "group") place((o) => cmd.addGroup(p.style!, o));
      else if (p.kind === "icon") place((o) => cmd.addIcon(p.icon!, p.label!, o));
      else if (p.kind === "entity") place((o) => cmd.addEntity(o));
      else if (p.kind === "sticky") place((o) => cmd.addSticky(o, p.color));
      else if (p.kind === "text") place((o) => cmd.addText(o));
      else if (p.kind === "pool") place((o) => cmd.addPool(o));
    },
    [cmd],
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  useShortcuts({
    undo: () => void cmd.undo(),
    redo: () => void cmd.redo(),
    remove: () => cmd.deleteIds(selectedIds),
    duplicate: () => cmd.duplicate(selectedIds),
    copy: () => cmd.copy(selectedIds),
    paste: cmd.paste,
    fit: () => setFitSignal((n) => n + 1),
    selectTool: () => setTool("select"),
    handTool: () => setTool("hand"),
    addSticky: () => cmd.addSticky(),
    addText: () => cmd.addText(),
    addRectangle: () => cmd.addShape("basic", "rectangle"),
    addEllipse: () => cmd.addShape("basic", "ellipse"),
    addGroup: () => cmd.addGroup("plain"),
  });

  const actions = useMemo(() => ({ canEdit, patch: cmd.patch, resized: cmd.resized }), [canEdit, cmd.patch, cmd.resized]);

  return {
    board,
    loaded,
    status: socket.status,
    canEdit,
    presence,
    tool,
    setTool: setToolMode,
    penColor: theme.shapeStroke,
    dark: theme.dark,
    items,
    selection: selectedIds,
    setSelection,
    selectedItem,
    armed,
    arm,
    fitSignal,
    flash: activity.flash,
    history,
    toast,
    cmd,
    actions,
    canvas: { moveEnded, resizeEnded, connect, createAt, drawEnded, eraseHit },
    onDrop,
    onDragOver,
    fit: () => setFitSignal((n) => n + 1),
  };
}
