import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import type { NoteGroupMetadata, NoteNodeTable, NotePropertyDef, NotePropertyOption, NotePropertyType, NoteViewDef, NoteViewType } from "../plugins/db";
import type { NoteRow } from "../lib/notes-tables";
import { logger } from "../lib/logger";
import {
  PROPERTY_TYPES,
  addPropertyColumn,
  changePropertyColumnType,
  defaultMetadata,
  deleteNote,
  dropPropertyColumn,
  ensureGroupTable,
  LEAF_KINDS,
  insertNote,
  listNotes,
  newPropertyId,
  updateNote,
} from "../lib/notes-tables";

const VIEW_TYPES = new Set<NoteViewType>(["table", "list", "kanban"]);

type GroupRow = NoteNodeTable;

async function requireGroup(organizationId: string, id: string): Promise<GroupRow | null> {
  const row = await db
    .selectFrom("note_node")
    .selectAll()
    .where("id", "=", id)
    .where("organizationId", "=", organizationId)
    .where("kind", "in", [...LEAF_KINDS])
    .executeTakeFirst();
  return row ?? null;
}

/** Backfills default metadata for legacy groups and makes sure the notes table exists. */
async function ensureInitialized(group: GroupRow): Promise<NoteGroupMetadata> {
  let metadata = group.metadata;
  if (!metadata || !Array.isArray(metadata.views)) {
    metadata = defaultMetadata();
    await db.updateTable("note_node").set({ metadata, updatedAt: new Date() }).where("id", "=", group.id).execute();
  }
  await ensureGroupTable(db, group.id);
  return metadata;
}

async function saveMetadata(groupId: string, metadata: NoteGroupMetadata) {
  await db.updateTable("note_node").set({ metadata, updatedAt: new Date() }).where("id", "=", groupId).execute();
}

function parseOptions(raw: unknown): NotePropertyOption[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const options: NotePropertyOption[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const value = (entry as { value?: unknown }).value;
    if (typeof value !== "string" || value.trim() === "") continue;
    const color = (entry as { color?: unknown }).color;
    const label = (entry as { label?: unknown }).label;
    const id = (entry as { id?: unknown }).id;
    options.push({
      id: typeof id === "string" && id ? id : crypto.randomUUID(),
      value: value.trim(),
      ...(typeof color === "string" ? { color } : {}),
      ...(typeof label === "string" && label ? { label } : {}),
    });
  }
  return options;
}

function validateProps(columns: NotePropertyDef[], props: unknown): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  if (props === undefined || props === null) return { ok: true, values: {} };
  if (typeof props !== "object" || Array.isArray(props)) return { ok: false, error: "invalid_props" };
  const byId = new Map(columns.map((c) => [c.id, c]));
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    const col = byId.get(key);
    if (!col) return { ok: false, error: `unknown_property:${key}` };
    if (value === null) {
      if (col.validation?.required) return { ok: false, error: `required_property:${key}` };
      values[key] = null;
      continue;
    }
    switch (col.type) {
      case "text":
      case "url":
      case "select":
      case "status":
      case "phone":
      case "email":
      case "id":
      case "place":
      case "person":
      case "files & media":
        if (typeof value !== "string") return { ok: false, error: `invalid_value:${key}` };
        if ((col.type === "select" || col.type === "status") && (col.options?.length ?? 0) > 0 && !col.options!.some((o) => o.value === value)) {
          return { ok: false, error: `invalid_option:${key}` };
        }
        values[key] = value;
        break;
      case "multiselect": {
        if (!Array.isArray(value)) return { ok: false, error: `invalid_value:${key}` };
        const items = value as unknown[];
        if ((col.options?.length ?? 0) > 0 && !items.every((v) => typeof v === "string" && col.options!.some((o) => o.value === v))) {
          return { ok: false, error: `invalid_option:${key}` };
        }
        values[key] = value;
        break;
      }
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, error: `invalid_value:${key}` };
        values[key] = value;
        break;
      case "checkbox":
        if (typeof value !== "boolean") return { ok: false, error: `invalid_value:${key}` };
        values[key] = value;
        break;
      case "date":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return { ok: false, error: `invalid_value:${key}` };
        values[key] = new Date(value);
        break;
    }
  }
  return { ok: true, values };
}

function serializeNote(row: NoteRow, columns: NotePropertyDef[]) {
  const props: Record<string, unknown> = {};
  for (const col of columns) {
    const value = row.props[col.id];
    props[col.id] = value instanceof Date ? value.toISOString() : value;
  }
  return {
    noteId: row.noteId,
    title: row.title,
    content: row.content,
    preview: row.preview,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    props,
  };
}

export const notesContentRoutes = new Hono()
  .get("/groups/:id/notes", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const rows = await listNotes(db, group.id);
    return c.json({
      columns: metadata.columns,
      views: metadata.views,
      notes: rows.map((row) => serializeNote(row, metadata.columns)),
    });
  })

  .post("/groups/:id/notes", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const body = await c.req.json().catch(() => null);
    const checked = validateProps(metadata.columns, body?.props);
    if (!checked.ok) return c.json({ error: checked.error }, 400);

    const title = typeof body?.title === "string" ? body.title.slice(0, 200) : "";
    const content = body?.content ?? {};
    const preview = typeof body?.preview === "string" ? body.preview.slice(0, 200) : "";
    const noteId = crypto.randomUUID();
    await insertNote(db, group.id, noteId, title, content, preview, checked.values);
    return c.json({ noteId }, 201);
  })

  .patch("/groups/:id/notes/:noteId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const body = await c.req.json().catch(() => null);
    if (!body || (body.title === undefined && body.content === undefined && body.preview === undefined && body.props === undefined)) {
      return c.json({ error: "empty_update" }, 400);
    }
    if (body.title !== undefined && typeof body.title !== "string") return c.json({ error: "invalid_title" }, 400);
    const checked = validateProps(metadata.columns, body.props);
    if (!checked.ok) return c.json({ error: checked.error }, 400);

    await updateNote(db, group.id, c.req.param("noteId"), {
      ...(body.title !== undefined ? { title: String(body.title).slice(0, 200) } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.preview !== undefined ? { preview: String(body.preview).slice(0, 200) } : {}),
      ...(body.props !== undefined ? { props: checked.values } : {}),
    });
    return c.json({ ok: true });
  })

  .delete("/groups/:id/notes/:noteId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    await ensureInitialized(group);
    await deleteNote(db, group.id, c.req.param("noteId"));
    return c.json({ ok: true });
  })

  .post("/groups/:id/properties", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const type = body?.type;
    if (!name) return c.json({ error: "invalid_name" }, 400);
    if (typeof type !== "string" || !PROPERTY_TYPES.includes(type as NotePropertyType)) return c.json({ error: "invalid_type" }, 400);

    const options = parseOptions(body?.options);
    if ((type === "select" || type === "multiselect") && options !== undefined && new Set(options.map((o) => o.value)).size !== options.length) {
      return c.json({ error: "duplicate_options" }, 400);
    }

    const def: NotePropertyDef = {
      id: newPropertyId(),
      name,
      type: type as NotePropertyType,
      ...(type === "select" || type === "multiselect" ? { options: options ?? [] } : {}),
      ...(body?.validation !== undefined && typeof body.validation === "object" && body.validation !== null
        ? { validation: body.validation as Record<string, unknown> }
        : {}),
    };
    await addPropertyColumn(db, group.id, def.id, def.type);
    await saveMetadata(group.id, { ...metadata, columns: [...metadata.columns, def] });
    return c.json(def, 201);
  })

  .patch("/groups/:id/properties/:propId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const propId = c.req.param("propId");
    const index = metadata.columns.findIndex((c2) => c2.id === propId);
    if (index === -1) return c.json({ error: "property_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const def = { ...metadata.columns[index] };
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return c.json({ error: "invalid_name" }, 400);
      def.name = name;
    }
    if (body?.type !== undefined) {
      if (typeof body.type !== "string" || !PROPERTY_TYPES.includes(body.type as NotePropertyType)) return c.json({ error: "invalid_type" }, 400);
      const to = body.type as NotePropertyType;
      if (to !== def.type) {
        logger.info({ id: propId, from: def.type, to }, "notes: property type change");
        try {
          await changePropertyColumnType(db, group.id, propId, def.type, to);
          logger.info({ id: propId }, "notes: property type change done");
        } catch (err) {
          const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          logger.error({ id: propId, err: detail }, "notes: property type change failed");
          return c.json({ error: `type_change_failed:${detail}` }, 400);
        }
        def.type = to;
        // Seed status columns with the 3 canonical statuses when they have none.
        if ((to === "select" || to === "multiselect" || to === "status") && !def.options) {
          def.options =
            to === "status"
              ? [
                  { id: `o_${crypto.randomUUID().slice(0, 8)}`, value: "To Do", label: "To Do" },
                  { id: `o_${crypto.randomUUID().slice(0, 8)}`, value: "In Progress", label: "In Progress" },
                  { id: `o_${crypto.randomUUID().slice(0, 8)}`, value: "Completed", label: "Completed" },
                ]
              : [];
        }
        if (to !== "select" && to !== "multiselect" && to !== "status") delete def.options;
      }
    }
    if (body?.options !== undefined) {
      if (def.type !== "select" && def.type !== "multiselect") return c.json({ error: "options_need_select_type" }, 400);
      const options = parseOptions(body.options) ?? [];
      if (new Set(options.map((o) => o.value)).size !== options.length) return c.json({ error: "duplicate_options" }, 400);
      def.options = options;
    }
    if (body?.validation !== undefined) {
      if (typeof body.validation !== "object" || body.validation === null) return c.json({ error: "invalid_validation" }, 400);
      def.validation = body.validation as Record<string, unknown>;
    }

    const columns = [...metadata.columns];
    columns[index] = def;
    await saveMetadata(group.id, { ...metadata, columns });
    return c.json(def);
  })

  .delete("/groups/:id/properties/:propId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const propId = c.req.param("propId");
    if (!metadata.columns.some((c2) => c2.id === propId)) return c.json({ error: "property_not_found" }, 404);

    await dropPropertyColumn(db, group.id, propId);
    const views = metadata.views.map((v) => ({
      ...v,
      ...(v.groupBy === propId ? { groupBy: null } : {}),
      ...(v.sorts ? { sorts: v.sorts.filter((srt) => srt.property !== propId) } : {}),
    }));
    await saveMetadata(group.id, {
      columns: metadata.columns.filter((c2) => c2.id !== propId),
      views,
    });
    return c.json({ ok: true });
  })

  .post("/groups/:id/views", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const body = await c.req.json().catch(() => null);
    const type = body?.type;
    if (typeof type !== "string" || !VIEW_TYPES.has(type as NoteViewType)) return c.json({ error: "invalid_type" }, 400);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : defaultViewName(type as NoteViewType, metadata.views);

    const view: NoteViewDef = { id: crypto.randomUUID(), name, type: type as NoteViewType };
    await saveMetadata(group.id, { ...metadata, views: [...metadata.views, view] });
    return c.json(view, 201);
  })

  .patch("/groups/:id/views/:viewId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const viewId = c.req.param("viewId");
    const index = metadata.views.findIndex((v) => v.id === viewId);
    if (index === -1) return c.json({ error: "view_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const view = { ...metadata.views[index] };
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return c.json({ error: "invalid_name" }, 400);
      view.name = name;
    }
    if (body?.groupBy !== undefined) {
      if (body.groupBy === null) view.groupBy = null;
      else {
        const prop = metadata.columns.find((c2) => c2.id === body.groupBy);
        if (!prop || prop.type !== "select") return c.json({ error: "groupBy_needs_select_property" }, 400);
        view.groupBy = prop.id;
      }
    }

    const views = [...metadata.views];
    views[index] = view;
    await saveMetadata(group.id, { ...metadata, views });
    return c.json(view);
  })

  .delete("/groups/:id/views/:viewId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const group = await requireGroup(s.organizationId, c.req.param("id"));
    if (!group) return c.json({ error: "group_not_found" }, 404);

    const metadata = await ensureInitialized(group);
    const viewId = c.req.param("viewId");
    if (!metadata.views.some((v) => v.id === viewId)) return c.json({ error: "view_not_found" }, 404);

    await saveMetadata(group.id, { ...metadata, views: metadata.views.filter((v) => v.id !== viewId) });
    return c.json({ ok: true });
  });

function defaultViewName(type: NoteViewType, views: NoteViewDef[]): string {
  const base = type[0].toUpperCase() + type.slice(1);
  let name = base;
  let n = 2;
  while (views.some((v) => v.name === name)) name = `${base} ${n++}`;
  return name;
}
