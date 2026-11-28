import { sql, type Generated, type Kysely } from "@twodb/core-data/db";

export interface BoardRow {
  id: string;
  workspace_id: string;
  space_id: string | null;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
}

export interface PinRow {
  id: string;
  workspace_id: string;
  board_id: string;
  /** The source URL (nullable — a pin can be a bare media upload with no link). */
  url: string | null;
  /** Final URL after following redirects during the last metadata fetch. */
  final_url: string | null;
  /** User-editable; seeded from og:title/<title> on fetch. */
  title: string | null;
  /** User-editable; seeded from og:description/meta description on fetch. */
  description: string | null;
  /** Free-text note attached by the user — never overwritten by fetches. */
  note: string | null;
  site_name: string | null;
  /** Fetch lifecycle: pending (created, never fetched), ok, error. */
  status: Generated<"pending" | "ok" | "error">;
  /** Last fetch error message, for surfacing in the UI. */
  fetch_error: string | null;
  fetched_at: Date | null;
  /** Downloaded preview image (og:image) — served via GET /pins/:id/image. */
  image: Buffer | null;
  image_content_type: string | null;
  /** Downloaded favicon — served via GET /pins/:id/favicon. */
  favicon: Buffer | null;
  favicon_content_type: string | null;
  /** Hero media kind: image (og:image) or video (downloaded clip). Null = no hero. */
  hero_kind: "image" | "video" | null;
  hero_content_type: string | null;
  /** Direct-uploaded media (image or video) — served via GET /pins/:id/media. */
  media: Buffer | null;
  media_content_type: string | null;
  /** Free-form tags, stored as a JSON array of strings. */
  tags: Generated<string[]>;
  created_by: string | null;
  created_at: Generated<Date>;
}

export interface BookmarkFolderRow {
  id: string;
  workspace_id: string;
  name: string;
  /** Parent folder for nesting; null = top level. */
  parent_id: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
}

export interface BookmarkRow {
  id: string;
  workspace_id: string;
  /** Nullable — a bookmark can live at the top level ("Unfiled"). */
  folder_id: string | null;
  url: string;
  title: string | null;
  description: string | null;
  /** Downloaded favicon — served via GET /bookmarks/:id/favicon. */
  favicon: Buffer | null;
  favicon_content_type: string | null;
  created_by: string | null;
  created_at: Generated<Date>;
}

/** Per-workspace app settings (share target board, etc). */
export interface WorkspaceSettingsRow {
  workspace_id: string;
  default_board_id: string | null;
}

export interface TwoPinDb {
  board: BoardRow;
  pin: PinRow;
  bookmark_folder: BookmarkFolderRow;
  bookmark: BookmarkRow;
  workspace_settings: WorkspaceSettingsRow;
}

export async function applySchema(db: Kysely<TwoPinDb>): Promise<void> {
  await db.schema
    .createTable("board")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("board_workspace_idx")
    .ifNotExists()
    .on("board")
    .columns(["workspace_id"])
    .execute();

  await db.schema
    .createTable("pin")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("board_id", "text", (c) => c.notNull().references("board.id").onDelete("cascade"))
    .addColumn("url", "text")
    .addColumn("final_url", "text")
    .addColumn("title", "text")
    .addColumn("description", "text")
    .addColumn("note", "text")
    .addColumn("site_name", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("fetch_error", "text")
    .addColumn("fetched_at", "timestamptz")
    .addColumn("image", "bytea")
    .addColumn("image_content_type", "text")
    .addColumn("favicon", "bytea")
    .addColumn("favicon_content_type", "text")
    .addColumn("tags", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("pin_board_idx")
    .ifNotExists()
    .on("pin")
    .columns(["board_id"])
    .execute();

  await db.schema
    .createIndex("pin_workspace_idx")
    .ifNotExists()
    .on("pin")
    .columns(["workspace_id"])
    .execute();

  await db.schema
    .createTable("bookmark_folder")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("parent_id", "text", (c) => c.references("bookmark_folder.id").onDelete("cascade"))
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("bookmark_folder_workspace_idx")
    .ifNotExists()
    .on("bookmark_folder")
    .columns(["workspace_id"])
    .execute();

  await db.schema
    .createTable("bookmark")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("folder_id", "text", (c) => c.references("bookmark_folder.id").onDelete("cascade"))
    .addColumn("url", "text", (c) => c.notNull())
    .addColumn("title", "text")
    .addColumn("description", "text")
    .addColumn("favicon", "bytea")
    .addColumn("favicon_content_type", "text")
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("bookmark_folder_idx")
    .ifNotExists()
    .on("bookmark")
    .columns(["folder_id"])
    .execute();

  await db.schema
    .createIndex("bookmark_workspace_idx")
    .ifNotExists()
    .on("bookmark")
    .columns(["workspace_id"])
    .execute();

  // Newer pin columns — separate ALTERs so existing databases upgrade in place
  // (createTable.ifNotExists won't touch a table that's already there).
  await db.schema.alterTable("pin").addColumn("hero_kind", "text").execute().catch(swallowDuplicateColumn);
  await db.schema.alterTable("pin").addColumn("hero_content_type", "text").execute().catch(swallowDuplicateColumn);
  await db.schema.alterTable("pin").addColumn("media", "bytea").execute().catch(swallowDuplicateColumn);
  await db.schema.alterTable("pin").addColumn("media_content_type", "text").execute().catch(swallowDuplicateColumn);
  await db.schema.alterTable("pin").addColumn("tags", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`)).execute().catch(swallowDuplicateColumn);
  // url became optional (pins can be bare media uploads). Postgres no-op on new DBs.
  await db.schema.alterTable("pin").alterColumn("url", (c) => c.dropNotNull()).execute().catch(() => {});
  // Removed features (intake queue, per-pin markdown editor / multi-extractors).
  await db.schema.dropTable("intake_item").ifExists().execute();
  await db.schema.alterTable("pin").dropColumn("content_md").execute().catch(() => {});
  await db.schema.alterTable("pin").dropColumn("extractor").execute().catch(() => {});

  // Bookmark folder nesting + per-workspace settings.
  await db.schema.alterTable("bookmark_folder").addColumn("parent_id", "text").execute().catch(swallowDuplicateColumn);

  await db.schema
    .createTable("workspace_settings")
    .ifNotExists()
    .addColumn("workspace_id", "text", (c) => c.primaryKey())
    .addColumn("default_board_id", "text")
    .execute();
}

/** Postgres error 42701 = duplicate_column — safe to ignore for idempotent ALTERs. */
function swallowDuplicateColumn(err: unknown) {
  if ((err as { code?: string })?.code === "42701") return;
  throw err;
}
