import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { defaultMetadata, dropGroupTable, ensureGroupTable, LEAF_KINDS } from "../lib/notes-tables";
import type { NoteKind, NoteNodeTable } from "../plugins/db";

const isLeafKind = (kind: string) => (LEAF_KINDS as readonly string[]).includes(kind);

interface NodeRef {
  id: string;
  parentId: string | null;
  kind: string;
}

/** Collects a node and all its descendants. */
async function collectSubtreeIds(rootId: string, organizationId: string): Promise<string[]> {
  const out = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await db.selectFrom("note_node").select("id").where("organizationId", "=", organizationId).where("parentId", "in", frontier).execute();
    frontier = children.map((c) => c.id);
    out.push(...frontier);
  }
  return out;
}

/** Drops physical tables for every leaf node in the subtree (excluding the root itself if not a leaf). */
async function dropSubtreeTables(subtree: string[], organizationId: string) {
  if (subtree.length <= 1) return;
  const leaves = await db
    .selectFrom("note_node")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where("id", "in", subtree)
    .where("kind", "in", [...LEAF_KINDS])
    .execute();
  for (const leaf of leaves) await dropGroupTable(db, leaf.id);
}

/** Walks the parent chain to the owning section node id. */
async function sectionOfNode(organizationId: string, nodeId: string): Promise<string | null> {
  let current: string | null = nodeId;
  for (let depth = 0; current && depth < 64; depth++) {
    const node = await db
      .selectFrom("note_node")
      .select(["id", "parentId", "kind"])
      .where("id", "=", current)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!node) return null;
    if (node.kind === "section") return node.id;
    current = node.parentId;
  }
  return null;
}

async function nextPosition(organizationId: string, parentId: string, kinds: NoteKind[]): Promise<number> {
  const [{ max }] = await db
    .selectFrom("note_node")
    .select((eb) => eb.fn.max("position").as("max"))
    .where("organizationId", "=", organizationId)
    .where("parentId", "=", parentId)
    .where("kind", "in", kinds)
    .execute();
  return (max ?? -1) + 1;
}

/** /tree response derives the legacy folder/group fields from the unified node rows. */
function treeResponse(nodes: NoteNodeTable[]) {
  const byId = new Map<string, NodeRef>(nodes.map((n) => [n.id, { id: n.id, parentId: n.parentId, kind: n.kind }]));
  const sectionOfRef = (nodeId: string): string | null => {
    let current: string | null = nodeId;
    for (let depth = 0; current && depth < 64; depth++) {
      const node = byId.get(current);
      if (!node) return null;
      if (node.kind === "section") return node.id;
      current = node.parentId;
    }
    return null;
  };

  const sections = nodes.filter((n) => n.kind === "section");
  const folders = nodes
    .filter((n) => n.kind === "folder")
    .map((n) => {
      const parent = n.parentId ? byId.get(n.parentId) : undefined;
      return { ...n, sectionId: sectionOfRef(n.id) ?? "", parentId: parent && parent.kind === "folder" ? parent.id : null };
    });
  const groups = nodes.filter((n) => isLeafKind(n.kind)).map((n) => ({ ...n, folderId: n.parentId ?? "", type: n.kind }));
  return { sections, folders, groups };
}

export const notesRoutes = new Hono()
  .get("/tree", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const nodes = await db
      .selectFrom("note_node")
      .selectAll()
      .where("organizationId", "=", s.organizationId)
      .orderBy("position", "asc")
      .orderBy("createdAt", "asc")
      .execute();
    return c.json(treeResponse(nodes));
  })

  .post("/sections", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "New section";
    const now = new Date();
    const row = await db
      .insertInto("note_node")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        parentId: null,
        kind: "section",
        name,
        position: await nextPosition(s.organizationId, "", ["section"]),
        isFavorite: false,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .patch("/sections/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const section = await db
      .selectFrom("note_node")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("kind", "=", "section")
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!section) return c.json({ error: "section_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return c.json({ error: "invalid_name" }, 400);

    const row = await db.updateTable("note_node").set({ name, updatedAt: new Date() }).where("id", "=", section.id).returningAll().executeTakeFirst();
    return c.json(row);
  })

  .delete("/sections/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const section = await db
      .selectFrom("note_node")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("kind", "=", "section")
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!section) return c.json({ error: "section_not_found" }, 404);

    const subtree = await collectSubtreeIds(section.id, s.organizationId);
    await dropSubtreeTables(subtree, s.organizationId);
    await db.deleteFrom("note_node").where("id", "=", section.id).execute();
    return c.json({ ok: true });
  })

  .post("/folders", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const sectionId = typeof body?.sectionId === "string" ? body.sectionId : "";
    const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : null;
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "New folder";
    if (!sectionId) return c.json({ error: "sectionId_required" }, 400);

    const section = await db
      .selectFrom("note_node")
      .select("id")
      .where("id", "=", sectionId)
      .where("kind", "=", "section")
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!section) return c.json({ error: "section_not_found" }, 404);

    if (parentId) {
      const parent = await db
        .selectFrom("note_node")
        .select("id")
        .where("id", "=", parentId)
        .where("kind", "=", "folder")
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!parent) return c.json({ error: "parent_not_found" }, 404);
      if ((await sectionOfNode(s.organizationId, parentId)) !== sectionId) return c.json({ error: "cross_section_move" }, 400);
    }

    const now = new Date();
    const row = await db
      .insertInto("note_node")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        parentId: parentId ?? sectionId,
        kind: "folder",
        name,
        position: await nextPosition(s.organizationId, parentId ?? sectionId, ["folder"]),
        isFavorite: false,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .patch("/folders/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const folder = await db
      .selectFrom("note_node")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("kind", "=", "folder")
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!folder) return c.json({ error: "folder_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; parentId: string }> = {};
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return c.json({ error: "invalid_name" }, 400);
      patch.name = name;
    }
    if (body?.parentId !== undefined) {
      const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
      const sectionId = await sectionOfNode(s.organizationId, folder.id);
      const targetParent = parentId ?? sectionId;
      if (!targetParent) return c.json({ error: "section_not_found" }, 404);
      if (parentId) {
        const parent = await db
          .selectFrom("note_node")
          .select("id")
          .where("id", "=", parentId)
          .where("kind", "=", "folder")
          .where("organizationId", "=", s.organizationId)
          .executeTakeFirst();
        if (!parent) return c.json({ error: "parent_not_found" }, 404);
        if ((await sectionOfNode(s.organizationId, parentId)) !== sectionId) return c.json({ error: "cross_section_move" }, 400);
        const subtree = await collectSubtreeIds(folder.id, s.organizationId);
        if (subtree.includes(parentId)) return c.json({ error: "cannot_move_into_descendant" }, 400);
      }
      patch.parentId = targetParent;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const movesParent = patch.parentId !== undefined && patch.parentId !== folder.parentId;
    const position = movesParent ? await nextPosition(s.organizationId, patch.parentId!, ["folder"]) : folder.position;

    const row = await db
      .updateTable("note_node")
      .set({ ...patch, ...(movesParent ? { position } : {}), updatedAt: new Date() })
      .where("id", "=", folder.id)
      .returningAll()
      .executeTakeFirst();
    return c.json(row);
  })

  .delete("/folders/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const folder = await db
      .selectFrom("note_node")
      .select("id")
      .where("id", "=", c.req.param("id"))
      .where("kind", "=", "folder")
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!folder) return c.json({ error: "folder_not_found" }, 404);

    const subtree = await collectSubtreeIds(folder.id, s.organizationId);
    await dropSubtreeTables(subtree, s.organizationId);
    await db.deleteFrom("note_node").where("id", "in", subtree).execute();
    return c.json({ ok: true });
  })

  .post("/groups", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const folderId = typeof body?.folderId === "string" ? body.folderId : "";
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "New group";
    const rawType = typeof body?.type === "string" ? body.type : "notes";
    if (!folderId) return c.json({ error: "folderId_required" }, 400);
    if (!isLeafKind(rawType)) return c.json({ error: "invalid_type" }, 400);

    const folder = await db
      .selectFrom("note_node")
      .select("id")
      .where("id", "=", folderId)
      .where("kind", "=", "folder")
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!folder) return c.json({ error: "folder_not_found" }, 404);

    const now = new Date();
    const row = await db
      .insertInto("note_node")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        parentId: folderId,
        kind: rawType as NoteKind,
        name,
        position: await nextPosition(s.organizationId, folderId, [...LEAF_KINDS]),
        isFavorite: false,
        metadata: defaultMetadata(),
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await ensureGroupTable(db, row.id);
    return c.json(row, 201);
  })

  .patch("/groups/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const group = await db
      .selectFrom("note_node")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!group || !isLeafKind(group.kind)) return c.json({ error: "group_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; kind: NoteKind; isFavorite: boolean; parentId: string }> = {};
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return c.json({ error: "invalid_name" }, 400);
      patch.name = name;
    }
    if (body?.type !== undefined) {
      if (typeof body.type !== "string" || !isLeafKind(body.type)) return c.json({ error: "invalid_type" }, 400);
      patch.kind = body.type as NoteKind;
    }
    if (body?.isFavorite !== undefined) patch.isFavorite = Boolean(body.isFavorite);

    const movesFolder = typeof body?.folderId === "string" && body.folderId !== group.parentId;
    if (movesFolder) {
      const folder = await db
        .selectFrom("note_node")
        .select("id")
        .where("id", "=", body.folderId)
        .where("kind", "=", "folder")
        .where("organizationId", "=", s.organizationId)
        .executeTakeFirst();
      if (!folder) return c.json({ error: "folder_not_found" }, 404);
      patch.parentId = body.folderId;
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const position = movesFolder ? await nextPosition(s.organizationId, body.folderId, [...LEAF_KINDS]) : group.position;

    const row = await db
      .updateTable("note_node")
      .set({ ...patch, ...(movesFolder ? { position } : {}), updatedAt: new Date() })
      .where("id", "=", group.id)
      .returningAll()
      .executeTakeFirst();
    return c.json(row);
  })

  .delete("/groups/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const group = await db
      .selectFrom("note_node")
      .select(["id", "kind"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!group || !isLeafKind(group.kind)) return c.json({ error: "group_not_found" }, 404);

    await dropGroupTable(db, group.id);
    await db.deleteFrom("note_node").where("id", "=", group.id).execute();
    return c.json({ ok: true });
  })

  /** Renumber the given ordered id list: position = array index. */
  .post("/reorder", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const kind = body?.kind;
    const ids: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    if (kind !== "section" && kind !== "folder" && kind !== "group") return c.json({ error: "invalid_kind" }, 400);
    if (ids.length === 0 || ids.some((id) => typeof id !== "string")) return c.json({ error: "ids_required" }, 400);

    const kindFilter: NoteKind[] = kind === "section" ? ["section"] : kind === "folder" ? ["folder"] : [...LEAF_KINDS];
    const owned = await db
      .selectFrom("note_node")
      .select("id")
      .where("organizationId", "=", s.organizationId)
      .where("kind", "in", kindFilter)
      .where("id", "in", ids as string[])
      .execute();
    const ownedSet = new Set(owned.map((r) => r.id));
    for (const id of ids as string[]) {
      if (!ownedSet.has(id)) return c.json({ error: "id_not_owned" }, 400);
    }

    await Promise.all(
      (ids as string[]).map((id, index) => db.updateTable("note_node").set({ position: index, updatedAt: new Date() }).where("id", "=", id).execute()),
    );
    return c.json({ ok: true });
  });
