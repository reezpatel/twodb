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
  /** The URL as the user submitted it (may differ from final_url after redirects). */
  url: string;
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
  created_by: string | null;
  created_at: Generated<Date>;
}

export interface TwoPinDb {
  board: BoardRow;
  pin: PinRow;
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
    .addColumn("url", "text", (c) => c.notNull())
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
}
