import { db } from "../auth";
import type { NoteDatabaseSchema, NotePropertyDef } from "../plugins/db";
import { addPropertyColumn, ensureDatabaseTable, insertRowProps } from "./notes-tables";
import { nextPosition } from "./notes-nodes";

/** Lock flag value for databases owned by the shared-content feature.
 *  Format: <app_name>:<feature_name>. */
export const SHARED_CONTENT_LOCK = "twodb:shared_content";

/** Row processing pipeline states. */
export const SHARED_CONTENT_STATUSES = ["saved", "pending", "downloading", "processing", "failed"] as const;
export type SharedContentStatus = (typeof SHARED_CONTENT_STATUSES)[number];

const STATUS_COLORS: Record<SharedContentStatus, string> = {
  saved: "green",
  pending: "yellow",
  downloading: "blue",
  processing: "blue",
  failed: "red",
};

/** Fixed property ids — stable so share intake / processing code can address
 *  them directly. */
export const SHARED_CONTENT_PROPS = {
  content: "content",
  url: "url",
  tags: "tags",
  site: "site",
  // Array of media ids (media_asset rows) — resolve via /api/storage/resolve/<id>.
  medias: "medias",
  status: "status",
} as const;

export function sharedContentColumns(): NotePropertyDef[] {
  return [
    { id: SHARED_CONTENT_PROPS.content, name: "Content", type: "text" },
    { id: SHARED_CONTENT_PROPS.url, name: "URL", type: "url" },
    { id: SHARED_CONTENT_PROPS.tags, name: "Tags", type: "multiselect", options: [] },
    { id: SHARED_CONTENT_PROPS.site, name: "Site", type: "url" },
    // Array of media ids (media_asset rows).
    { id: SHARED_CONTENT_PROPS.medias, name: "Medias", type: "media" },
    {
      id: SHARED_CONTENT_PROPS.status,
      name: "Status",
      type: "select",
      options: SHARED_CONTENT_STATUSES.map((value) => ({
        id: `o_${value}`,
        value,
        label: value[0].toUpperCase() + value.slice(1),
        color: STATUS_COLORS[value],
      })),
    },
  ];
}

export function sharedContentSchema(): NoteDatabaseSchema {
  return {
    columns: sharedContentColumns(),
    views: [
      { id: crypto.randomUUID(), name: "Table", type: "table" },
      { id: crypto.randomUUID(), name: "List", type: "list" },
      { id: crypto.randomUUID(), name: "Kanban", type: "kanban", groupBy: SHARED_CONTENT_PROPS.status },
    ],
  };
}

export function isSharedContentDatabase(node: { kind: string; schemaLockedBy: string | null }): boolean {
  return node.kind === "database" && node.schemaLockedBy === SHARED_CONTENT_LOCK;
}

export function siteOfUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isInstagramUrl(url: string): boolean {
  const site = siteOfUrl(url);
  return site === "instagram.com" || site === "instagr.am";
}

/** Creates a locked shared_content database. Root-level by default; it can be
 *  moved under any page/section afterwards like any other database. */
export async function createSharedContentDatabase(organizationId: string, title: string, parentId: string | null = null) {
  const now = new Date();
  const schema = sharedContentSchema();
  const row = await db
    .insertInto("note_node")
    .values({
      id: crypto.randomUUID(),
      organizationId,
      parentId,
      kind: "database",
      title: title.slice(0, 200) || "Shared content",
      schema,
      schemaLockedBy: SHARED_CONTENT_LOCK,
      position: await nextPosition(organizationId, parentId),
      createdAt: now,
      updatedAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await ensureDatabaseTable(db, row.id);
  for (const col of schema.columns) {
    await addPropertyColumn(db, row.id, col.id, col.type);
  }
  return row;
}

export interface SharedContentRowInput {
  databaseId: string;
  title: string;
  /** Everything else about the share, as markdown. */
  content?: string | null;
  url?: string | null;
  tags?: string[];
  /** Explicit site override; derived from url when omitted. */
  site?: string | null;
  /** Media ids (media_asset rows) for media already in storage. */
  medias?: string[];
  status: SharedContentStatus;
}

/** Adds a row to a shared_content database. Bypasses the generic property
 *  validation — the locked schema is fixed, we know the shapes. */
export async function insertSharedContentRow(organizationId: string, input: SharedContentRowInput) {
  const now = new Date();
  const noteId = crypto.randomUUID();
  await db
    .insertInto("note_node")
    .values({
      id: noteId,
      organizationId,
      parentId: input.databaseId,
      kind: "page",
      title: input.title.slice(0, 200),
      content: { doc: { type: "doc", content: [] } },
      preview: (input.content ?? "").slice(0, 200),
      position: await nextPosition(organizationId, input.databaseId),
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  const props: Record<string, unknown> = {
    [SHARED_CONTENT_PROPS.content]: input.content ?? null,
    [SHARED_CONTENT_PROPS.url]: input.url ?? null,
    [SHARED_CONTENT_PROPS.tags]: input.tags ?? [],
    [SHARED_CONTENT_PROPS.site]: input.site ?? (input.url ? siteOfUrl(input.url) : null),
    [SHARED_CONTENT_PROPS.medias]: input.medias ?? [],
    [SHARED_CONTENT_PROPS.status]: input.status,
  };
  await insertRowProps(db, input.databaseId, noteId, props);
  return noteId;
}
