// Board / item persistence. EVERY item write goes through applyBatch(): one
// transaction that mutates `items`, appends a `board_events` row (with the
// inverse ops, so undo is just "apply the inverse") and NOTIFYs listeners.
import { sql, type Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import type { PaintressDb, BoardRow, ItemRow } from "./db/schema.js";
import {
  parseItemData,
  type Board,
  type BoardEvent,
  type BatchRequest,
  type BatchResult,
  type Item,
  type ItemType,
  type NewItem,
  type Op,
} from "./shared/model.js";
import { LAYOUT, entityHeight, getShape } from "./shared/shapes.js";

export const NOTIFY_CHANNEL = "paintress_board";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

export function rowToBoard(r: BoardRow): Board {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    spaceId: r.space_id,
    kind: r.kind,
    name: r.name,
    description: r.description,
    lastSeq: Number(r.last_seq),
    docVersion: r.doc_version,
    createdBy: r.created_by,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function rowToItem(r: ItemRow): Item {
  return {
    id: r.id,
    boardId: r.board_id,
    key: r.key,
    type: r.type as ItemType,
    parentId: r.parent_id,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    zIndex: r.z_index,
    locked: r.locked,
    pinned: r.pinned,
    version: r.version,
    data: r.data ?? {},
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Item → create-op payload that reproduces it exactly (used for undo of deletes). */
function itemToNew(i: Item): NewItem {
  return {
    id: i.id,
    key: i.key,
    type: i.type,
    parentId: i.parentId,
    x: i.x,
    y: i.y,
    width: i.width,
    height: i.height,
    zIndex: i.zIndex,
    locked: i.locked,
    pinned: i.pinned,
    data: i.data,
  };
}

export function defaultSize(type: ItemType, data: Record<string, unknown>): { width: number; height: number } {
  switch (type) {
    case "shape": {
      const s = getShape(String(data.pack ?? "basic"), String(data.shape ?? "rectangle"));
      return { width: s.w, height: s.h };
    }
    case "group":
      return { width: 420, height: 300 };
    case "pool":
      return { width: 900, height: 320 };
    case "lane":
      return { width: 860, height: LAYOUT.laneMinH };
    case "entity":
      return { width: LAYOUT.entityWidth, height: entityHeight(((data.columns as unknown[]) ?? []).length) };
    case "sticky":
      return { width: 180, height: 180 };
    case "text":
      return { width: 220, height: 40 };
    case "image":
      return { width: 240, height: 160 };
    case "edge":
      return { width: 0, height: 0 };
  }
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------
export function createStore(db: Kysely<PaintressDb>) {
  async function getBoardRow(id: string, workspaceId: string): Promise<BoardRow> {
    const row = await db.selectFrom("boards").selectAll().where("id", "=", id).where("deleted_at", "is", null).executeTakeFirst();
    // 404 (not 403) for other workspaces so ids don't leak.
    if (!row || row.workspace_id !== workspaceId) throw new HttpError(404, "board_not_found");
    return row;
  }

  async function listBoards(workspaceId: string, spaceIds?: string[]): Promise<Board[]> {
    let q = db.selectFrom("boards").selectAll().where("workspace_id", "=", workspaceId).where("deleted_at", "is", null);
    if (spaceIds?.length) q = q.where("space_id", "in", spaceIds);
    const rows = await q.orderBy("updated_at", "desc").execute();
    return rows.map(rowToBoard);
  }

  async function createBoard(input: {
    workspaceId: string;
    spaceId: string;
    actor: string;
    name: string;
    kind: "diagram" | "doc";
    description?: string;
    markdown?: string;
  }): Promise<Board> {
    const row = await db
      .insertInto("boards")
      .values({
        id: ulid(),
        workspace_id: input.workspaceId,
        space_id: input.spaceId,
        kind: input.kind,
        name: input.name,
        description: input.description ?? "",
        doc_markdown: input.kind === "doc" ? (input.markdown ?? `# ${input.name}\n`) : "",
        doc_version: 0,
        last_seq: 0,
        created_by: input.actor,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return rowToBoard(row);
  }

  async function updateBoard(id: string, workspaceId: string, patch: { name?: string; description?: string }): Promise<Board> {
    await getBoardRow(id, workspaceId);
    const row = await db
      .updateTable("boards")
      .set({ ...patch, updated_at: sql`now()` } as never)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return rowToBoard(row);
  }

  async function deleteBoard(id: string, workspaceId: string): Promise<void> {
    await getBoardRow(id, workspaceId);
    await db.updateTable("boards").set({ deleted_at: sql`now()` } as never).where("id", "=", id).execute();
  }

  async function listItems(boardId: string, filter: { type?: string; parentId?: string } = {}): Promise<Item[]> {
    let q = db.selectFrom("items").selectAll().where("board_id", "=", boardId).where("deleted_at", "is", null);
    if (filter.type) q = q.where("type", "=", filter.type);
    if (filter.parentId) q = q.where("parent_id", "=", filter.parentId);
    const rows = await q.orderBy("z_index").orderBy("created_at").execute();
    return rows.map(rowToItem);
  }

  // -------------------------------------------------------------------------
  // The write path
  // -------------------------------------------------------------------------
  async function applyBatch(
    boardId: string,
    workspaceId: string,
    actor: string,
    req: Pick<BatchRequest, "ops" | "label" | "clientId">,
  ): Promise<BatchResult> {
    return db.transaction().execute(async (trx) => {
      const board = await trx.selectFrom("boards").selectAll().where("id", "=", boardId).where("deleted_at", "is", null).forUpdate().executeTakeFirst();
      if (!board || board.workspace_id !== workspaceId) throw new HttpError(404, "board_not_found");
      if (board.kind !== "diagram") throw new HttpError(400, "not_a_diagram_board", "Items only exist on diagram boards");

      const touched = new Map<string, Item>(); // final state of created/updated items
      const deleted = new Set<string>();
      const inverse: Op[] = [];
      const skipped: string[] = [];

      const loadItem = async (id: string, includeDeleted = false): Promise<ItemRow | undefined> => {
        let q = trx.selectFrom("items").selectAll().where("board_id", "=", boardId).where("id", "=", id);
        if (!includeDeleted) q = q.where("deleted_at", "is", null);
        return q.executeTakeFirst();
      };

      for (const op of req.ops) {
        if (op.op === "create") {
          const n = op.item;
          const id = n.id ?? ulid();
          let data: Record<string, unknown>;
          try {
            data = parseItemData(n.type, n.data);
          } catch (e) {
            throw new HttpError(400, "invalid_item_data", `${n.type}: ${(e as Error).message}`);
          }
          if (n.parentId) {
            const parent = await loadItem(n.parentId);
            if (!parent) {
              skipped.push(`create ${id}: parent ${n.parentId} not found`);
              continue;
            }
          }
          const size = defaultSize(n.type, data);
          const existing = await loadItem(id, true);
          if (existing && !existing.deleted_at) {
            skipped.push(`create ${id}: id already exists`);
            continue;
          }
          if (n.key) {
            const clash = await trx
              .selectFrom("items")
              .select("id")
              .where("board_id", "=", boardId)
              .where("key", "=", n.key)
              .where("deleted_at", "is", null)
              .executeTakeFirst();
            if (clash) {
              skipped.push(`create ${id}: key "${n.key}" already used by ${clash.id}`);
              continue;
            }
          }
          const values = {
            key: n.key ?? null,
            type: n.type,
            parent_id: n.parentId ?? null,
            x: n.x,
            y: n.y,
            width: n.width ?? size.width,
            height: n.height ?? size.height,
            z_index: n.zIndex ?? Date.now() / 1000,
            locked: n.locked ?? false,
            pinned: n.pinned ?? false,
            data: JSON.stringify(data),
            updated_by: actor,
            updated_at: sql`now()`,
            deleted_at: null,
          };
          const row = existing
            ? await trx
                .updateTable("items")
                .set({ ...values, version: existing.version + 1 } as never)
                .where("id", "=", id)
                .returningAll()
                .executeTakeFirstOrThrow()
            : await trx
                .insertInto("items")
                .values({ id, board_id: boardId, version: 1, created_by: actor, ...values } as never)
                .returningAll()
                .executeTakeFirstOrThrow();
          const item = rowToItem(row);
          touched.set(id, item);
          deleted.delete(id);
          inverse.push({ op: "delete", id });
        } else if (op.op === "update") {
          const row = await loadItem(op.id);
          if (!row) {
            skipped.push(`update ${op.id}: not found`);
            continue;
          }
          if (op.ifVersion !== undefined && op.ifVersion !== row.version) {
            skipped.push(`update ${op.id}: version conflict (have ${row.version}, expected ${op.ifVersion})`);
            continue;
          }
          const p = op.patch;
          const set: Record<string, unknown> = { updated_by: actor, updated_at: sql`now()`, version: row.version + 1 };
          const undo: Record<string, unknown> = {};
          const scalar = [
            ["x", "x"],
            ["y", "y"],
            ["width", "width"],
            ["height", "height"],
            ["zIndex", "z_index"],
            ["locked", "locked"],
            ["pinned", "pinned"],
            ["parentId", "parent_id"],
            ["key", "key"],
          ] as const;
          for (const [k, col] of scalar) {
            const v = (p as Record<string, unknown>)[k];
            if (v === undefined) continue;
            set[col] = v;
            undo[k] = (row as unknown as Record<string, unknown>)[col];
          }
          if (p.parentId) {
            if (p.parentId === op.id || !(await loadItem(p.parentId))) {
              skipped.push(`update ${op.id}: invalid parent ${p.parentId}`);
              continue;
            }
          }
          if (p.key) {
            const clash = await trx
              .selectFrom("items")
              .select("id")
              .where("board_id", "=", boardId)
              .where("key", "=", p.key)
              .where("id", "!=", op.id)
              .where("deleted_at", "is", null)
              .executeTakeFirst();
            if (clash) {
              skipped.push(`update ${op.id}: key "${p.key}" already used`);
              continue;
            }
          }
          if (p.data) {
            const merged: Record<string, unknown> = { ...(row.data ?? {}) };
            const undoData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(p.data)) {
              undoData[k] = k in merged ? merged[k] : null;
              if (v === null) delete merged[k];
              else merged[k] = v;
            }
            try {
              set.data = JSON.stringify(parseItemData(row.type as ItemType, merged));
            } catch (e) {
              throw new HttpError(400, "invalid_item_data", `${row.type}: ${(e as Error).message}`);
            }
            undo.data = undoData;
          }
          const updated = await trx.updateTable("items").set(set as never).where("id", "=", op.id).returningAll().executeTakeFirstOrThrow();
          touched.set(op.id, rowToItem(updated));
          inverse.push({ op: "update", id: op.id, patch: undo });
        } else {
          // delete: cascade to descendants and to edges attached to anything removed
          const root = await loadItem(op.id);
          if (!root) {
            skipped.push(`delete ${op.id}: not found`);
            continue;
          }
          const all = await trx.selectFrom("items").selectAll().where("board_id", "=", boardId).where("deleted_at", "is", null).execute();
          const doomed = new Map<string, ItemRow>([[root.id, root]]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const r of all) {
              if (doomed.has(r.id)) continue;
              const d = r.data as { from?: { itemId?: string }; to?: { itemId?: string } };
              if (
                (r.parent_id && doomed.has(r.parent_id)) ||
                (r.type === "edge" && ((d.from?.itemId && doomed.has(d.from.itemId)) || (d.to?.itemId && doomed.has(d.to.itemId))))
              ) {
                doomed.set(r.id, r);
                grew = true;
              }
            }
          }
          const ids = [...doomed.keys()];
          await trx
            .updateTable("items")
            .set({ deleted_at: sql`now()`, updated_by: actor, updated_at: sql`now()` } as never)
            .where("board_id", "=", boardId)
            .where("id", "in", ids)
            .execute();
          // Undo re-creates parents before children, edges last.
          const order = [...doomed.values()].sort((a, b) => Number(a.type === "edge") - Number(b.type === "edge"));
          const ranked = topoByParent(order);
          // (pushed reversed: the whole inverse list is reversed once at the end)
          for (const r of [...ranked].reverse()) inverse.push({ op: "create", item: itemToNew(rowToItem(r)) });
          for (const id of ids) {
            touched.delete(id);
            deleted.add(id);
          }
        }
      }

      inverse.reverse();
      const batchId = ulid();
      const upserts = [...touched.values()].filter((i) => !deleted.has(i.id));
      const deletes = [...deleted];
      let seq = Number(board.last_seq);
      if (upserts.length || deletes.length) {
        const ev = await trx
          .insertInto("board_events")
          .values({
            board_id: boardId,
            actor,
            origin: req.clientId ?? null,
            batch_id: batchId,
            label: req.label ?? null,
            payload: JSON.stringify({ upserts, deletes, inverse, doc: null }),
          } as never)
          .returning("seq")
          .executeTakeFirstOrThrow();
        seq = Number(ev.seq);
        await trx.updateTable("boards").set({ last_seq: seq, updated_at: sql`now()` } as never).where("id", "=", boardId).execute();
        await sql`select pg_notify(${NOTIFY_CHANNEL}, ${`${boardId}:${seq}`})`.execute(trx);
      }
      return { seq, batchId, upserts, deletes, inverse, skipped };
    });
  }

  async function applyDoc(
    boardId: string,
    workspaceId: string,
    actor: string,
    origin: string | null,
    markdown: string,
    ifVersion?: number,
    label?: string,
  ): Promise<{ seq: number; version: number }> {
    return db.transaction().execute(async (trx) => {
      const board = await trx.selectFrom("boards").selectAll().where("id", "=", boardId).where("deleted_at", "is", null).forUpdate().executeTakeFirst();
      if (!board || board.workspace_id !== workspaceId) throw new HttpError(404, "board_not_found");
      if (board.kind !== "doc") throw new HttpError(400, "not_a_doc_board");
      if (ifVersion !== undefined && ifVersion !== board.doc_version) {
        throw new HttpError(409, "version_conflict", `doc is at version ${board.doc_version}, you edited ${ifVersion}`);
      }
      const version = board.doc_version + 1;
      const ev = await trx
        .insertInto("board_events")
        .values({
          board_id: boardId,
          actor,
          origin,
          batch_id: ulid(),
          label: label ?? null,
          payload: JSON.stringify({ upserts: [], deletes: [], inverse: [], doc: { markdown, version } }),
        } as never)
        .returning("seq")
        .executeTakeFirstOrThrow();
      const seq = Number(ev.seq);
      await trx
        .updateTable("boards")
        .set({ doc_markdown: markdown, doc_version: version, last_seq: seq, updated_at: sql`now()` } as never)
        .where("id", "=", boardId)
        .execute();
      await sql`select pg_notify(${NOTIFY_CHANNEL}, ${`${boardId}:${seq}`})`.execute(trx);
      return { seq, version };
    });
  }

  async function eventsSince(boardId: string, since: number, limit = 500): Promise<BoardEvent[]> {
    const rows = await db
      .selectFrom("board_events")
      .selectAll()
      .where("board_id", "=", boardId)
      .where("seq", ">", since as never)
      .orderBy("seq")
      .limit(limit)
      .execute();
    return rows.map((r) => {
      const p = r.payload as { upserts?: Item[]; deletes?: string[]; inverse?: Op[]; doc?: { markdown: string; version: number } | null };
      return {
        seq: Number(r.seq),
        boardId: r.board_id,
        actor: r.actor,
        origin: r.origin,
        batchId: r.batch_id,
        label: r.label,
        ts: iso(r.created_at),
        upserts: p.upserts ?? [],
        deletes: p.deletes ?? [],
        inverse: p.inverse ?? [],
        doc: p.doc ?? null,
      };
    });
  }

  async function oldestSeq(boardId: string): Promise<number> {
    const r = await db.selectFrom("board_events").select(sql<string>`coalesce(min(seq), 0)`.as("m")).where("board_id", "=", boardId).executeTakeFirst();
    return Number(r?.m ?? 0);
  }

  return {
    db,
    getBoardRow,
    listBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    listItems,
    applyBatch,
    applyDoc,
    eventsSince,
    oldestSeq,
  };
}

export type Store = ReturnType<typeof createStore>;

function topoByParent(rows: ItemRow[]): ItemRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: ItemRow[] = [];
  const seen = new Set<string>();
  const visit = (r: ItemRow) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    if (r.parent_id && byId.has(r.parent_id)) visit(byId.get(r.parent_id)!);
    out.push(r);
  };
  rows.forEach(visit);
  return out;
}
