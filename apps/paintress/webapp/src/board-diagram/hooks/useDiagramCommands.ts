import { useCallback, useRef, type MutableRefObject } from "react";
import type { Node, Connection } from "@xyflow/react";
import type { BatchResult, Item, ItemPatch, NewItem, Op } from "@shared/model";
import { LAYOUT, entityHeight, findShape, getGroupStyle } from "@shared/shapes";
import { absPosition, adoptVersions, applyOpsLocal, newId, type ItemMap } from "../../lib/item-store";
import { cloneOps, containerAt } from "../../lib/containers";
import { handleToColumn } from "../../lib/flow-graph";
import { paintressClient } from "../../lib/paintress-client";
import type { useHistory } from "./useHistory";

export interface CommandDeps {
  boardId: string;
  itemsRef: MutableRefObject<ItemMap>;
  setItems(fn: (m: ItemMap) => ItemMap): void;
  sendOps(ops: Op[], label?: string): Promise<BatchResult>;
  history: ReturnType<typeof useHistory>;
  canEdit: boolean;
  notify(message: string): void;
  resync(): void;
  /** Screen → flow coordinates (React Flow). */
  toFlow(p: { x: number; y: number }): { x: number; y: number };
}

type Placeable = Omit<NewItem, "x" | "y" | "parentId"> & { width: number; height: number };

/**
 * Business hook: every way the human changes the board. Each command is ONE
 * batch (= one undo step): applied optimistically, sent over the socket, and
 * recorded in history using the server-computed inverse.
 */
export function useDiagramCommands(deps: CommandDeps) {
  const d = useRef(deps);
  d.current = deps;
  const clipboard = useRef<Item[]>([]);

  const commit = useCallback(async (ops: Op[], label: string, opts: { record?: boolean } = {}): Promise<BatchResult | undefined> => {
    const { boardId, setItems, sendOps, history, canEdit, notify, resync } = d.current;
    if (!canEdit) {
      notify("Offline — reconnecting…");
      return undefined;
    }
    setItems((m) => applyOpsLocal(m, ops, boardId, "me"));
    try {
      const res = await sendOps(ops, label);
      setItems((m) => adoptVersions(m, res.upserts));
      if (res.skipped.length) notify(res.skipped[0]!);
      if (opts.record !== false) history.record({ label, ops: res.inverse });
      return res;
    } catch (e) {
      notify(`Change not saved: ${(e as Error).message}`);
      resync();
      return undefined;
    }
  }, []);

  const patch = useCallback(
    (id: string, p: ItemPatch, label = "Edit") => {
      const cur = d.current.itemsRef.current.get(id);
      const cols = (p.data?.columns as unknown[] | undefined)?.length;
      const extra: ItemPatch = cur?.type === "entity" && cols !== undefined ? { height: Math.max(entityHeight(cols), 0) } : {};
      void commit([{ op: "update", id, patch: { ...p, ...extra } }], label);
    },
    [commit],
  );

  const resized = useCallback(
    (id: string, box: { x: number; y: number; width: number; height: number }) => {
      const m = d.current.itemsRef.current;
      const cur = m.get(id);
      if (!cur) return;
      const ops: Op[] = [{ op: "update", id, patch: { ...box, pinned: true } }];
      if (cur.type === "lane" && cur.parentId) {
        // Lanes stack: growing one pushes the lanes below it down and grows the pool.
        const dh = box.height - cur.height;
        if (dh !== 0) {
          for (const l of m.values()) if (l.type === "lane" && l.parentId === cur.parentId && l.id !== id && l.y > cur.y) ops.push({ op: "update", id: l.id, patch: { y: l.y + dh } });
          const pool = m.get(cur.parentId);
          if (pool) ops.push({ op: "update", id: pool.id, patch: { height: pool.height + dh } });
        }
      } else if (cur.type === "pool") {
        for (const l of m.values()) if (l.type === "lane" && l.parentId === id) ops.push({ op: "update", id: l.id, patch: { width: box.width - LAYOUT.laneGutter } });
      }
      void commit(ops, "Resize");
    },
    [commit],
  );

  /** Create one item at a flow-space point (or the viewport centre), inside whatever group/lane is under it. */
  const place = useCallback(
    (item: Placeable, at?: { x: number; y: number }, label = "Add item") => {
      const m = d.current.itemsRef.current;
      const point = at ?? d.current.toFlow({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const container = item.type === "pool" ? null : containerAt(m, point, new Set());
      const base = container ? absPosition(m, container) : { x: 0, y: 0 };
      const id = item.id ?? newId();
      void commit(
        [{ op: "create", item: { ...item, id, x: point.x - item.width / 2 - base.x, y: point.y - item.height / 2 - base.y, parentId: container?.id ?? null, pinned: true } }],
        label,
      );
      return id;
    },
    [commit],
  );

  const addShape = (pack: string, shape: string, at?: { x: number; y: number }) => {
    const def = findShape(shape, pack) ?? findShape("rectangle")!;
    return place({ type: "shape", width: def.w, height: def.h, data: { pack: def.pack, shape: def.id, text: def.label === "Rectangle" ? "" : def.label } }, at, `Add ${def.label.toLowerCase()}`);
  };
  const addGroup = (styleId: string, at?: { x: number; y: number }) => {
    const s = getGroupStyle(styleId);
    return place({ type: "group", width: 420, height: 300, data: { pack: s.pack, kind: s.id, title: s.label } }, at, `Add ${s.label}`);
  };
  const addEntity = (at?: { x: number; y: number }) =>
    place(
      { type: "entity", width: LAYOUT.entityWidth, height: entityHeight(2), data: { name: "table", columns: [{ id: "id", name: "id", type: "uuid", pk: true }, { id: "name", name: "name", type: "text" }] } },
      at,
      "Add table",
    );
  const addSticky = (at?: { x: number; y: number }) => place({ type: "sticky", width: 180, height: 180, data: { text: "", color: "#fde68a" } }, at, "Add note");
  const addText = (at?: { x: number; y: number }) => place({ type: "text", width: 220, height: 40, data: { text: "Text", fontSize: 18, align: "left" } }, at, "Add text");
  const addIcon = (icon: string, label: string, at?: { x: number; y: number }) =>
    place({ type: "shape", width: 120, height: 100, data: { pack: "basic", shape: "icon-card", text: label, icon } }, at, `Add ${label}`);

  const addPool = (at?: { x: number; y: number }) => {
    const m = d.current.itemsRef.current;
    void m;
    const point = at ?? d.current.toFlow({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const pool = newId();
    const w = 900;
    const laneH = LAYOUT.laneMinH;
    void commit(
      [
        { op: "create", item: { id: pool, type: "pool", x: point.x - w / 2, y: point.y - laneH, width: w, height: laneH * 2, pinned: true, data: { title: "Process" } } },
        { op: "create", item: { type: "lane", parentId: pool, x: LAYOUT.laneGutter, y: 0, width: w - LAYOUT.laneGutter, height: laneH, data: { title: "Lane 1" } } },
        { op: "create", item: { type: "lane", parentId: pool, x: LAYOUT.laneGutter, y: laneH, width: w - LAYOUT.laneGutter, height: laneH, data: { title: "Lane 2" } } },
      ],
      "Add swimlanes",
    );
  };

  const addLane = (poolId: string) => {
    const m = d.current.itemsRef.current;
    const pool = m.get(poolId);
    if (!pool) return;
    const lanes = [...m.values()].filter((l) => l.type === "lane" && l.parentId === poolId);
    const y = lanes.reduce((a, l) => Math.max(a, l.y + l.height), 0);
    void commit(
      [
        { op: "create", item: { type: "lane", parentId: poolId, x: LAYOUT.laneGutter, y, width: pool.width - LAYOUT.laneGutter, height: LAYOUT.laneMinH, data: { title: `Lane ${lanes.length + 1}` } } },
        { op: "update", id: poolId, patch: { height: y + LAYOUT.laneMinH } },
      ],
      "Add lane",
    );
  };

  const addImage = async (file: File, at?: { x: number; y: number }) => {
    try {
      const asset = await paintressClient.uploadAsset(d.current.boardId, file);
      const size = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth || 320, h: img.naturalHeight || 200 });
        img.onerror = () => res({ w: 320, h: 200 });
        img.src = paintressClient.assetUrl(asset.id);
      });
      const scale = Math.min(1, 480 / size.w);
      place({ type: "image", width: Math.round(size.w * scale), height: Math.round(size.h * scale), data: { assetId: asset.id, alt: file.name } }, at, "Add image");
    } catch (e) {
      d.current.notify(`Upload failed: ${(e as Error).message}`);
    }
  };

  const connect = useCallback(
    (c: Connection) => {
      const m = d.current.itemsRef.current;
      const from = m.get(c.source);
      const to = m.get(c.target);
      if (!from || !to || c.source === c.target) return;
      const relation = from.type === "entity" && to.type === "entity";
      const data = {
        from: { itemId: from.id, ...(handleToColumn(c.sourceHandle) ? { handle: handleToColumn(c.sourceHandle) } : {}) },
        to: { itemId: to.id, ...(handleToColumn(c.targetHandle) ? { handle: handleToColumn(c.targetHandle) } : {}) },
        kind: relation ? "relation" : "flow",
        routing: "orthogonal",
        startCap: "none",
        endCap: relation ? "none" : "arrow",
        ...(relation ? { cardinality: { from: "zero_or_many", to: "one" } } : {}),
      };
      void commit([{ op: "create", item: { type: "edge", x: 0, y: 0, data } }], "Connect");
    },
    [commit],
  );

  /** After a drag: commit new positions, moving items into/out of the group or lane they were dropped on. */
  const dragEnded = useCallback(
    (nodes: Node[]) => {
      const m = d.current.itemsRef.current;
      const moving = new Set(nodes.map((n) => n.id));
      const ops: Op[] = [];
      for (const n of nodes) {
        const item = m.get(n.id);
        if (!item || item.locked) continue;
        const parent = item.parentId ? m.get(item.parentId) : undefined;
        const parentAbs = parent ? absPosition(m, parent) : { x: 0, y: 0 };
        const abs = { x: parentAbs.x + n.position.x, y: parentAbs.y + n.position.y };
        // Pools and lanes keep their structure; everything else re-parents by where its centre landed.
        if (item.type === "pool" || item.type === "lane") {
          if (n.position.x !== item.x || n.position.y !== item.y) ops.push({ op: "update", id: n.id, patch: { x: n.position.x, y: n.position.y, pinned: true } });
          continue;
        }
        const centre = { x: abs.x + item.width / 2, y: abs.y + item.height / 2 };
        const target = containerAt(m, centre, moving);
        const targetId = target?.id ?? null;
        if (targetId !== item.parentId) {
          const base = target ? absPosition(m, target) : { x: 0, y: 0 };
          ops.push({ op: "update", id: n.id, patch: { parentId: targetId, x: abs.x - base.x, y: abs.y - base.y, pinned: true } });
        } else if (n.position.x !== item.x || n.position.y !== item.y) {
          ops.push({ op: "update", id: n.id, patch: { x: n.position.x, y: n.position.y, pinned: true } });
        }
      }
      if (ops.length) void commit(ops, ops.length > 1 ? `Move ${ops.length} items` : "Move");
    },
    [commit],
  );

  const deleteIds = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      void commit(ids.map((id) => ({ op: "delete" as const, id })), ids.length > 1 ? `Delete ${ids.length} items` : "Delete");
    },
    [commit],
  );

  const duplicate = useCallback(
    (ids: string[]) => {
      const m = d.current.itemsRef.current;
      const items = ids.map((id) => m.get(id)).filter((i): i is Item => !!i);
      if (!items.length) return;
      void commit(cloneOps(m, items, { x: 28, y: 28 }).ops, "Duplicate");
    },
    [commit],
  );
  const copy = useCallback((ids: string[]) => {
    const m = d.current.itemsRef.current;
    clipboard.current = ids.map((id) => m.get(id)).filter((i): i is Item => !!i);
  }, []);
  const paste = useCallback(() => {
    if (!clipboard.current.length) return;
    const m = d.current.itemsRef.current;
    const { ops } = cloneOps(m, clipboard.current, { x: 28, y: 28 });
    void commit(ops, "Paste");
    clipboard.current = clipboard.current.map((i) => ({ ...i, x: i.x + 28, y: i.y + 28 }));
  }, [commit]);

  const undo = useCallback(async () => {
    const { history, boardId, setItems, sendOps, notify, resync } = d.current;
    const e = history.takeUndo();
    if (!e) return;
    setItems((m) => applyOpsLocal(m, e.ops, boardId, "me"));
    try {
      const res = await sendOps(e.ops, `Undo: ${e.label}`);
      setItems((m) => adoptVersions(m, res.upserts));
      history.pushRedo({ label: e.label, ops: res.inverse });
    } catch (err) {
      notify(`Undo failed: ${(err as Error).message}`);
      resync();
    }
  }, []);
  const redo = useCallback(async () => {
    const { history, boardId, setItems, sendOps, notify, resync } = d.current;
    const e = history.takeRedo();
    if (!e) return;
    setItems((m) => applyOpsLocal(m, e.ops, boardId, "me"));
    try {
      const res = await sendOps(e.ops, `Redo: ${e.label}`);
      setItems((m) => adoptVersions(m, res.upserts));
      history.pushUndo({ label: e.label, ops: res.inverse });
    } catch (err) {
      notify(`Redo failed: ${(err as Error).message}`);
      resync();
    }
  }, []);

  const tidy = useCallback(async (direction: "LR" | "TB" = "LR") => {
    try {
      const res = await paintressClient.relayout(d.current.boardId, direction);
      if (res.inverse?.length) d.current.history.record({ label: "Tidy up", ops: res.inverse });
      if (res.warnings.length) d.current.notify(res.warnings[0]!);
    } catch (e) {
      d.current.notify(`Tidy up failed: ${(e as Error).message}`);
    }
  }, []);

  return { commit, patch, resized, addShape, addGroup, addEntity, addSticky, addText, addIcon, addPool, addLane, addImage, connect, dragEnded, deleteIds, duplicate, copy, paste, undo, redo, tidy };
}
