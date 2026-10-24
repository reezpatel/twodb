import { Hono } from "hono";
import { sql } from "kysely";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { defaultSchema, ensureDatabaseTable, insertRowProps } from "../lib/notes-tables";
import {
  ancestors,
  detachedInlineSql,
  getNode,
  isEmptyContent,
  isSelfOrDescendant,
  nextPosition,
  restore,
  softDelete,
  type NoteNode,
} from "../lib/notes-nodes";
import { readAssetBytesById, storeNoteAsset } from "../lib/assets";
import { logger } from "../lib/logger";
import type { NoteNodeUpdate } from "../plugins/db";

/** Sidebar-facing shape: no content/schema payloads. */
function treeNode(
  n: Pick<NoteNode, "id" | "parentId" | "kind" | "title" | "icon" | "inline" | "position" | "isFavorite" | "updatedAt">,
  extra: { isRow: boolean; dangling: boolean },
) {
  return {
    id: n.id,
    parentId: n.parentId,
    kind: n.kind,
    title: n.title,
    icon: n.icon,
    inline: n.inline,
    position: n.position,
    isFavorite: n.isFavorite,
    updatedAt: n.updatedAt,
    ...extra,
  };
}

/** Full node payload for the page/database scene. */
async function nodeDetail(organizationId: string, node: NoteNode) {
  const [crumbs, children] = await Promise.all([
    ancestors(organizationId, node),
    db
      .selectFrom("note_node")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("organizationId", "=", organizationId)
      .where("parentId", "=", node.id)
      .where("deletedAt", "is", null)
      .executeTakeFirst(),
  ]);
  const parent = crumbs.at(-1) ?? null;
  return {
    ...node,
    ancestors: crumbs,
    childCount: Number(children?.count ?? 0),
    isRow: parent?.kind === "database",
    isEmpty: node.kind === "page" && isEmptyContent(node.content) && Number(children?.count ?? 0) === 0,
  };
}

function str(v: unknown, max = 500): string | undefined {
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

export const notesRoutes = new Hono()
  /** Sections, pages and databases for the sidebar. Database rows are left
   *  out (they live in the database views) unless starred. Dangling =
   *  database whose parent was deleted, or inline database whose block was
   *  removed from its page. */
  .get("/tree", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const rows = await db
      .selectFrom("note_node as n")
      .leftJoin("note_node as p", "p.id", "n.parentId")
      .select([
        "n.id",
        "n.parentId",
        "n.kind",
        "n.title",
        "n.icon",
        "n.inline",
        "n.position",
        "n.isFavorite",
        "n.updatedAt",
        "p.kind as parentKind",
        "p.deletedAt as parentDeletedAt",
        "p.id as parentExists",
        detachedInlineSql("n", "p").as("detached"),
      ])
      .where("n.organizationId", "=", s.organizationId)
      .where("n.deletedAt", "is", null)
      .orderBy("n.position", "asc")
      .orderBy("n.createdAt", "asc")
      .execute();

    const nodes = [];
    for (const r of rows) {
      const isRow = r.parentKind === "database";
      if (isRow && (!r.isFavorite || r.parentDeletedAt)) continue;
      const orphaned = r.parentId !== null && (!r.parentExists || r.parentDeletedAt !== null);
      const dangling = r.kind === "database" && (orphaned || Boolean(r.detached));
      // pages under a deleted parent are unreachable (their batch was deleted with it)
      if (r.kind !== "database" && !isRow && orphaned) continue;
      nodes.push(treeNode(r, { isRow, dangling }));
    }
    return c.json({ nodes });
  })

  .post("/sections", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    const title = str(body?.title, 200)?.trim() || "New section";
    const now = new Date();
    const row = await db
      .insertInto("note_node")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        parentId: null,
        kind: "section",
        title,
        position: await nextPosition(s.organizationId, null),
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  /** Create a page (default) or database under a section/page. Under a
   *  database the new node is a row page and gets a property row. */
  .post("/nodes", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    const parentId = str(body?.parentId);
    if (!parentId) return c.json({ error: "parentId_required" }, 400);
    const parent = await getNode(s.organizationId, parentId);
    if (!parent) return c.json({ error: "parent_not_found" }, 404);

    const kind = body?.kind === "database" ? "database" : "page";
    if (parent.kind === "database" && kind !== "page") return c.json({ error: "database_rows_are_pages" }, 400);
    const inline = kind === "database" && parent.kind === "page" && body?.inline === true;

    const now = new Date();
    const row = await db
      .insertInto("note_node")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        parentId: parent.id,
        kind,
        title: str(body?.title, 200) ?? "",
        content: kind === "page" ? { doc: { type: "doc", content: [] } } : null,
        schema: kind === "database" ? defaultSchema() : null,
        inline,
        position: await nextPosition(s.organizationId, parent.id),
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (kind === "database") await ensureDatabaseTable(db, row.id);
    if (parent.kind === "database") {
      await ensureDatabaseTable(db, parent.id);
      await insertRowProps(db, parent.id, row.id, {});
    }
    return c.json(row, 201);
  })

  .get("/nodes/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    // deleted nodes stay readable (opened from the databases browser)
    const node = await getNode(s.organizationId, c.req.param("id"), { includeDeleted: true });
    if (!node) return c.json({ error: "node_not_found" }, 404);
    return c.json(await nodeDetail(s.organizationId, node));
  })

  .patch("/nodes/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const node = await getNode(s.organizationId, c.req.param("id"), { includeDeleted: true });
    if (!node) return c.json({ error: "node_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: NoteNodeUpdate = {};
    if (body?.title !== undefined) {
      if (typeof body.title !== "string") return c.json({ error: "invalid_title" }, 400);
      patch.title = body.title.slice(0, 200);
    }
    if (body?.isFavorite !== undefined) patch.isFavorite = Boolean(body.isFavorite);
    if (typeof body?.position === "number" && Number.isFinite(body.position)) patch.position = body.position;
    if (node.kind !== "section") {
      if (body?.icon !== undefined) patch.icon = typeof body.icon === "string" ? body.icon : null;
      if (body?.cover !== undefined) patch.cover = typeof body.cover === "string" ? body.cover : null;
    }
    if (node.kind === "page") {
      if (body?.content !== undefined) {
        if (typeof body.content !== "object" || body.content === null) return c.json({ error: "invalid_content" }, 400);
        patch.content = body.content as Record<string, unknown>;
      }
      if (body?.preview !== undefined) patch.preview = String(body.preview).slice(0, 200);
    }

    // Move: pages/databases re-parent under a section or page (never into a
    // database — rows are created there). A moved database is no longer inline.
    if (typeof body?.parentId === "string" && body.parentId !== node.parentId) {
      if (node.kind === "section") return c.json({ error: "sections_are_roots" }, 400);
      const target = await getNode(s.organizationId, body.parentId);
      if (!target || target.kind === "database") return c.json({ error: "invalid_parent" }, 400);
      if (await isSelfOrDescendant(s.organizationId, node.id, target.id)) return c.json({ error: "cycle" }, 400);
      patch.parentId = target.id;
      patch.inline = false;
      if (patch.position === undefined) patch.position = await nextPosition(s.organizationId, target.id);
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("note_node")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", node.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  /** page → database. One-way, and only while the page is empty (no content,
   *  no children). Creates the database's property table. */
  .post("/nodes/:id/convert", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const node = await getNode(s.organizationId, c.req.param("id"));
    if (!node) return c.json({ error: "node_not_found" }, 404);
    if (node.kind !== "page") return c.json({ error: "only_pages_convert" }, 400);

    const detail = await nodeDetail(s.organizationId, node);
    if (detail.isRow) return c.json({ error: "rows_cannot_convert" }, 400);
    if (!detail.isEmpty) return c.json({ error: "page_not_empty" }, 409);

    await ensureDatabaseTable(db, node.id);
    const row = await db
      .updateTable("note_node")
      .set({ kind: "database", content: null, preview: "", schema: defaultSchema(), updatedAt: new Date() })
      .where("id", "=", node.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  /** Soft delete. Pages/sections take their page subtree; databases are
   *  never hard-deleted (and the ones under a deleted page turn dangling). */
  .delete("/nodes/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const node = await getNode(s.organizationId, c.req.param("id"));
    if (!node) return c.json({ error: "node_not_found" }, 404);
    await softDelete(s.organizationId, node);
    return c.json({ ok: true });
  })

  .post("/nodes/:id/restore", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const node = await getNode(s.organizationId, c.req.param("id"), { includeDeleted: true });
    if (!node) return c.json({ error: "node_not_found" }, 404);
    await restore(s.organizationId, node);
    return c.json({ ok: true });
  })

  /** Every database in the org (live, dangling and deleted) for the
   *  databases browser. */
  .get("/databases", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const dbs = await db
      .selectFrom("note_node as n")
      .leftJoin("note_node as p", "p.id", "n.parentId")
      .select([
        "n.id",
        "n.parentId",
        "n.title",
        "n.icon",
        "n.inline",
        "n.isFavorite",
        "n.deletedAt",
        "n.updatedAt",
        "p.title as parentTitle",
        "p.kind as parentKind",
        "p.deletedAt as parentDeletedAt",
        "p.id as parentExists",
        detachedInlineSql("n", "p").as("detached"),
        sql<number>`(SELECT count(*) FROM note_node r WHERE r."parentId" = n.id AND r."deletedAt" IS NULL)`.as("rowCount"),
      ])
      .where("n.organizationId", "=", s.organizationId)
      .where("n.kind", "=", "database")
      .orderBy("n.updatedAt", "desc")
      .execute();

    return c.json({
      databases: dbs.map((d) => ({
        id: d.id,
        parentId: d.parentId,
        title: d.title,
        icon: d.icon,
        inline: d.inline,
        isFavorite: d.isFavorite,
        deletedAt: d.deletedAt,
        updatedAt: d.updatedAt,
        parentTitle: d.parentTitle,
        parentKind: d.parentKind,
        rowCount: Number(d.rowCount),
        dangling: !d.deletedAt && ((d.parentId !== null && (!d.parentExists || d.parentDeletedAt !== null)) || Boolean(d.detached)),
      })),
    });
  })

  /** Renumber an ordered list of sibling ids: position = array index. */
  .post("/reorder", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    const ids: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0 || ids.some((id) => typeof id !== "string")) return c.json({ error: "ids_required" }, 400);

    const owned = await db
      .selectFrom("note_node")
      .select(["id", "parentId"])
      .where("organizationId", "=", s.organizationId)
      .where("id", "in", ids as string[])
      .execute();
    if (owned.length !== ids.length) return c.json({ error: "id_not_owned" }, 400);
    if (new Set(owned.map((r) => r.parentId)).size > 1) return c.json({ error: "not_siblings" }, 400);

    const now = new Date();
    await Promise.all((ids as string[]).map((id, index) => db.updateTable("note_node").set({ position: index, updatedAt: now }).where("id", "=", id).execute()));
    return c.json({ ok: true });
  })

  /** Header cover/icon (and in-page image) uploads → note_assets destination. */
  .post("/nodes/:id/assets", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const node = await getNode(s.organizationId, c.req.param("id"));
    if (!node) return c.json({ error: "node_not_found" }, 404);

    const form = await c.req.parseBody().catch(() => null);
    const file = form?.["file"];
    if (!file || typeof file === "string") return c.json({ error: "invalid_file" }, 400);
    if (file.size === 0) return c.json({ error: "empty_file" }, 400);
    if (file.size > 25 * 1024 * 1024) return c.json({ error: "file_too_large" }, 413);
    if (file.type && !file.type.startsWith("image/")) return c.json({ error: "images_only" }, 400);

    try {
      const asset = await storeNoteAsset({
        organizationId: s.organizationId,
        filename: file.name || "note-asset",
        contentType: file.type || null,
        data: Buffer.from(await file.arrayBuffer()),
      });
      return c.json({ ...asset, previewUrl: `/api/notes/assets/${asset.id}` }, 201);
    } catch (e) {
      const message = (e as Error).message;
      if (message === "note_assets_not_configured") return c.json({ error: message }, 409);
      logger.error({ err: e }, "notes: asset upload failed");
      return c.json({ error: message || "upload_failed" }, 500);
    }
  })

  .get("/assets/:mediaId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    try {
      const asset = await readAssetBytesById(s.organizationId, c.req.param("mediaId") ?? "");
      return c.body(new Uint8Array(asset.body), 200, {
        "content-type": asset.contentType,
        "content-disposition": `inline; filename="${asset.filename.replace(/"/g, "")}"`,
      });
    } catch (e) {
      const message = (e as Error).message;
      if (message === "asset_not_found") return c.json({ error: message }, 404);
      return c.json({ error: message || "read_failed" }, 500);
    }
  });
