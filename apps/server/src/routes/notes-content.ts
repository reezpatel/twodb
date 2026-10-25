import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import type { NoteDatabaseSchema, NoteNode, NoteNodeUpdate, NotePropertyDef, NotePropertyOption, NotePropertyType, NoteViewDef, NoteViewType } from "../plugins/db";
import type { NoteRow } from "../lib/notes-tables";
import { logger } from "../lib/logger";
import {
  PROPERTY_TYPES,
  addPropertyColumn,
  changePropertyColumnType,
  defaultSchema,
  dropPropertyColumn,
  ensureDatabaseTable,
  insertRowProps,
  listNotes,
  newPropertyId,
  updateRowProps,
} from "../lib/notes-tables";
import { getNode, nextPosition, softDelete } from "../lib/notes-nodes";

const VIEW_TYPES = new Set<NoteViewType>(["table", "list", "kanban"]);

/** Databases stay addressable after soft delete (browser can open them). */
async function requireDatabase(organizationId: string, id: string): Promise<NoteNode | null> {
  const node = await getNode(organizationId, id, { includeDeleted: true });
  return node && node.kind === "database" ? node : null;
}

/** Backfills a default schema and makes sure the property table exists. */
async function ensureInitialized(database: NoteNode): Promise<NoteDatabaseSchema> {
  let schema = database.schema;
  if (!schema || !Array.isArray(schema.views)) {
    schema = defaultSchema();
    await saveSchema(database.id, schema);
  }
  await ensureDatabaseTable(db, database.id);
  return schema;
}

async function saveSchema(databaseId: string, schema: NoteDatabaseSchema) {
  await db.updateTable("note_node").set({ schema, updatedAt: new Date() }).where("id", "=", databaseId).execute();
}

/** Row page under this database (live). */
async function requireRow(organizationId: string, databaseId: string, rowId: string) {
  const row = await getNode(organizationId, rowId);
  return row && row.kind === "page" && row.parentId === databaseId ? row : null;
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
      case "media": {
        // Array of media ids (strings).
        if (!Array.isArray(value) || !(value as unknown[]).every((v) => typeof v === "string")) return { ok: false, error: `invalid_value:${key}` };
        values[key] = (value as string[]).filter((v) => v.trim() !== "");
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
    icon: row.icon,
    cover: row.cover,
    isFavorite: row.isFavorite,
    content: row.content,
    preview: row.preview,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    props,
  };
}

export const notesContentRoutes = new Hono()
  .get("/databases/:id/rows", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);

    const schema = await ensureInitialized(database);
    const rows = await listNotes(db, database.id);
    return c.json({
      columns: schema.columns,
      views: schema.views,
      schemaLockedBy: database.schemaLockedBy,
      notes: rows.map((row) => serializeNote(row, schema.columns)),
    });
  })

  /** New row = a page node under the database + its property row. */
  .post("/databases/:id/rows", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);

    const schema = await ensureInitialized(database);
    const body = await c.req.json().catch(() => null);
    const checked = validateProps(schema.columns, body?.props);
    if (!checked.ok) return c.json({ error: checked.error }, 400);

    const now = new Date();
    const noteId = crypto.randomUUID();
    await db
      .insertInto("note_node")
      .values({
        id: noteId,
        organizationId: s.organizationId,
        parentId: database.id,
        kind: "page",
        title: typeof body?.title === "string" ? body.title.slice(0, 200) : "",
        content: (body?.content as Record<string, unknown>) ?? { doc: { type: "doc", content: [] } },
        preview: typeof body?.preview === "string" ? body.preview.slice(0, 200) : "",
        position: await nextPosition(s.organizationId, database.id),
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    await insertRowProps(db, database.id, noteId, checked.values);
    return c.json({ noteId }, 201);
  })

  .patch("/databases/:id/rows/:rowId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);
    const row = await requireRow(s.organizationId, database.id, c.req.param("rowId"));
    if (!row) return c.json({ error: "row_not_found" }, 404);

    const schema = await ensureInitialized(database);
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: "empty_update" }, 400);
    if (body.title !== undefined && typeof body.title !== "string") return c.json({ error: "invalid_title" }, 400);
    const checked = validateProps(schema.columns, body.props);
    if (!checked.ok) return c.json({ error: checked.error }, 400);

    const patch: NoteNodeUpdate = {};
    if (body.title !== undefined) patch.title = String(body.title).slice(0, 200);
    if (body.content !== undefined) patch.content = body.content as Record<string, unknown>;
    if (body.preview !== undefined) patch.preview = String(body.preview).slice(0, 200);
    if (body.icon !== undefined) patch.icon = typeof body.icon === "string" ? body.icon : null;
    if (body.cover !== undefined) patch.cover = typeof body.cover === "string" ? body.cover : null;
    if (Object.keys(patch).length > 0) {
      await db.updateTable("note_node").set({ ...patch, updatedAt: new Date() }).where("id", "=", row.id).execute();
    }
    if (body.props !== undefined && Object.keys(checked.values).length > 0) {
      await insertRowProps(db, database.id, row.id, {});
      await updateRowProps(db, database.id, row.id, checked.values);
    }
    return c.json({ ok: true });
  })

  /** Rows are pages — deleting one is a soft delete like any page. */
  .delete("/databases/:id/rows/:rowId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);
    const row = await requireRow(s.organizationId, database.id, c.req.param("rowId"));
    if (!row) return c.json({ error: "row_not_found" }, 404);
    await softDelete(s.organizationId, row);
    return c.json({ ok: true });
  })

  .post("/databases/:id/properties", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);
    if (database.schemaLockedBy) return c.json({ error: "schema_locked", lockedBy: database.schemaLockedBy }, 403);

    const schema = await ensureInitialized(database);
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
    await addPropertyColumn(db, database.id, def.id, def.type);
    await saveSchema(database.id, { ...schema, columns: [...schema.columns, def] });
    return c.json(def, 201);
  })

  .patch("/databases/:id/properties/:propId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);
    if (database.schemaLockedBy) return c.json({ error: "schema_locked", lockedBy: database.schemaLockedBy }, 403);

    const schema = await ensureInitialized(database);
    const propId = c.req.param("propId");
    const index = schema.columns.findIndex((c2) => c2.id === propId);
    if (index === -1) return c.json({ error: "property_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const def = { ...schema.columns[index] };
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
          await changePropertyColumnType(db, database.id, propId, def.type, to);
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

    const columns = [...schema.columns];
    columns[index] = def;
    await saveSchema(database.id, { ...schema, columns });
    return c.json(def);
  })

  .delete("/databases/:id/properties/:propId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);
    if (database.schemaLockedBy) return c.json({ error: "schema_locked", lockedBy: database.schemaLockedBy }, 403);

    const schema = await ensureInitialized(database);
    const propId = c.req.param("propId");
    if (!schema.columns.some((c2) => c2.id === propId)) return c.json({ error: "property_not_found" }, 404);

    await dropPropertyColumn(db, database.id, propId);
    const views = schema.views.map((v) => ({
      ...v,
      ...(v.groupBy === propId ? { groupBy: null } : {}),
      ...(v.sorts ? { sorts: v.sorts.filter((srt) => srt.property !== propId) } : {}),
    }));
    await saveSchema(database.id, {
      columns: schema.columns.filter((c2) => c2.id !== propId),
      views,
    });
    return c.json({ ok: true });
  })

  .post("/databases/:id/views", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);

    const schema = await ensureInitialized(database);
    const body = await c.req.json().catch(() => null);
    const type = body?.type;
    if (typeof type !== "string" || !VIEW_TYPES.has(type as NoteViewType)) return c.json({ error: "invalid_type" }, 400);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : defaultViewName(type as NoteViewType, schema.views);

    const view: NoteViewDef = { id: crypto.randomUUID(), name, type: type as NoteViewType };
    await saveSchema(database.id, { ...schema, views: [...schema.views, view] });
    return c.json(view, 201);
  })

  .patch("/databases/:id/views/:viewId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);

    const schema = await ensureInitialized(database);
    const viewId = c.req.param("viewId");
    const index = schema.views.findIndex((v) => v.id === viewId);
    if (index === -1) return c.json({ error: "view_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const view = { ...schema.views[index] };
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return c.json({ error: "invalid_name" }, 400);
      view.name = name;
    }
    if (body?.groupBy !== undefined) {
      if (body.groupBy === null) view.groupBy = null;
      else {
        const prop = schema.columns.find((c2) => c2.id === body.groupBy);
        if (!prop || prop.type !== "select") return c.json({ error: "groupBy_needs_select_property" }, 400);
        view.groupBy = prop.id;
      }
    }

    const views = [...schema.views];
    views[index] = view;
    await saveSchema(database.id, { ...schema, views });
    return c.json(view);
  })

  .delete("/databases/:id/views/:viewId", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const database = await requireDatabase(s.organizationId, c.req.param("id"));
    if (!database) return c.json({ error: "database_not_found" }, 404);

    const schema = await ensureInitialized(database);
    const viewId = c.req.param("viewId");
    if (!schema.views.some((v) => v.id === viewId)) return c.json({ error: "view_not_found" }, 404);

    await saveSchema(database.id, { ...schema, views: schema.views.filter((v) => v.id !== viewId) });
    return c.json({ ok: true });
  });

function defaultViewName(type: NoteViewType, views: NoteViewDef[]): string {
  const base = type[0].toUpperCase() + type.slice(1);
  let name = base;
  let n = 2;
  while (views.some((v) => v.name === name)) name = `${base} ${n++}`;
  return name;
}
