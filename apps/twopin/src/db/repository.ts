import { ulid } from "ulid";
import { sql, type Kysely, type Selectable } from "kysely";
import type { TwoPinDb, BoardRow, PinRow, BookmarkFolderRow, BookmarkRow } from "./schema.js";

export function createBoardsRepo(db: Kysely<TwoPinDb>) {
  return {
    async list(workspaceId: string): Promise<(Selectable<BoardRow> & { pin_count: number })[]> {
      const rows = await db
        .selectFrom("board")
        .leftJoin("pin", (j) => j.onRef("pin.board_id", "=", "board.id"))
        .selectAll("board")
        .select((eb) => eb.fn.count("pin.id").as("pin_count"))
        .where("board.workspace_id", "=", workspaceId)
        .groupBy("board.id")
        .orderBy("board.created_at", "asc")
        .execute();
      return rows.map((r) => ({ ...r, pin_count: Number(r.pin_count) }));
    },

    async get(workspaceId: string, id: string): Promise<Selectable<BoardRow> | undefined> {
      return db
        .selectFrom("board")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async create(input: {
      workspaceId: string;
      spaceId?: string | null;
      name: string;
      description?: string | null;
      createdBy: string | null;
    }): Promise<Selectable<BoardRow>> {
      return db
        .insertInto("board")
        .values({
          id: ulid(),
          workspace_id: input.workspaceId,
          space_id: input.spaceId ?? null,
          name: input.name,
          description: input.description ?? null,
          created_by: input.createdBy,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async update(
      workspaceId: string,
      id: string,
      patch: { name?: string; description?: string | null; spaceId?: string | null },
    ): Promise<Selectable<BoardRow> | undefined> {
      return db
        .updateTable("board")
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.spaceId !== undefined ? { space_id: patch.spaceId } : {}),
        })
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(workspaceId: string, id: string): Promise<boolean> {
      const res = await db
        .deleteFrom("board")
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
      return Number(res.numDeletedRows) > 0;
    },
  };
}

export function createPinsRepo(db: Kysely<TwoPinDb>) {
  return {
    async list(workspaceId: string, boardId?: string, tag?: string): Promise<Selectable<PinRow>[]> {
      let q = db
        .selectFrom("pin")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .orderBy("created_at", "desc");
      if (boardId) q = q.where("board_id", "=", boardId);
      if (tag) q = q.where(sql<boolean>`tags @> ${JSON.stringify([tag])}::jsonb`);
      return q.execute();
    },

    async get(workspaceId: string, id: string): Promise<Selectable<PinRow> | undefined> {
      return db
        .selectFrom("pin")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async create(input: {
      workspaceId: string;
      boardId: string;
      /** Optional — a pin can be a bare media upload with no source link. */
      url?: string | null;
      note?: string | null;
      /** Direct-uploaded media (image or video) for URL-less pins. */
      media?: Buffer | null;
      mediaContentType?: string | null;
      /** Pre-filled fields (e.g. from a server-side metadata fetch). */
      title?: string | null;
      description?: string | null;
      siteName?: string | null;
      tags?: string[];
      createdBy: string | null;
    }): Promise<Selectable<PinRow>> {
      return db
        .insertInto("pin")
        .values({
          id: ulid(),
          workspace_id: input.workspaceId,
          board_id: input.boardId,
          url: input.url ?? null,
          note: input.note ?? null,
          status: "pending",
          title: input.title ?? null,
          description: input.description ?? null,
          site_name: input.siteName ?? null,
          media: input.media ?? null,
          media_content_type: input.mediaContentType ?? null,
          tags: JSON.stringify(cleanTags(input.tags)),
          created_by: input.createdBy,
        } as never)
        .returningAll()
        .executeTakeFirstOrThrow();
    },


    /** Applies the result of a metadata fetch. Title/description only fill in
     * when the pin doesn't already have (user-edited) values unless
     * `overwriteText` is set (explicit refresh). */
    async applyFetch(
      id: string,
      result:
        | {
            ok: true;
            finalUrl: string;
            title: string | null;
            description: string | null;
            siteName: string | null;
            image: Buffer | null;
            imageContentType: string | null;
            favicon: Buffer | null;
            faviconContentType: string | null;
            overwriteText: boolean;
          }
        | { ok: false; error: string },
    ): Promise<Selectable<PinRow> | undefined> {
      if (!result.ok) {
        return db
          .updateTable("pin")
          .set({ status: "error", fetch_error: result.error, fetched_at: new Date() })
          .where("id", "=", id)
          .returningAll()
          .executeTakeFirst();
      }
      const pin = await db.selectFrom("pin").selectAll().where("id", "=", id).executeTakeFirst();
      if (!pin) return undefined;
      return db
        .updateTable("pin")
        .set({
          status: "ok",
          fetch_error: null,
          fetched_at: new Date(),
          final_url: result.finalUrl,
          title: result.overwriteText || !pin.title ? result.title : pin.title,
          description: result.overwriteText || !pin.description ? result.description : pin.description,
          site_name: result.siteName,
          image: result.image,
          image_content_type: result.imageContentType,
          hero_kind: result.image ? "image" : null,
          hero_content_type: result.image ? result.imageContentType : null,
          favicon: result.favicon,
          favicon_content_type: result.faviconContentType,
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
    },

    async update(
      workspaceId: string,
      id: string,
      patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null; url?: string; tags?: string[] },
    ): Promise<Selectable<PinRow> | undefined> {
      return db
        .updateTable("pin")
        .set({
          ...(patch.boardId !== undefined ? { board_id: patch.boardId } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          ...(patch.url !== undefined ? { url: patch.url } : {}),
          ...(patch.tags !== undefined ? { tags: JSON.stringify(cleanTags(patch.tags)) } : {}),
        } as never)
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
    },

    /** Replaces a pin's directly-uploaded media (image/video). */
    async setMedia(workspaceId: string, id: string, media: Buffer, contentType: string): Promise<Selectable<PinRow> | undefined> {
      return db
        .updateTable("pin")
        .set({ media, media_content_type: contentType })
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(workspaceId: string, id: string): Promise<boolean> {
      const res = await db
        .deleteFrom("pin")
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
      return Number(res.numDeletedRows) > 0;
    },

    /** Distinct tags across the workspace's pins, with counts (for filter chips / suggestions). */
    async listTags(workspaceId: string): Promise<{ tag: string; count: number }[]> {
      const rows = await sql<{ tag: string; count: number }>`
        select t.tag as tag, count(*)::int as count
        from pin, jsonb_array_elements_text(tags) as t(tag)
        where pin.workspace_id = ${workspaceId}
        group by t.tag order by count desc, t.tag asc`.execute(db);
      return rows.rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
    },
  };
}

/** Normalizes tags: trim, drop empties, dedupe case-insensitively, cap length/count. */
function cleanTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase().slice(0, 40);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 50) break;
  }
  return out;
}

export function createBookmarkFoldersRepo(db: Kysely<TwoPinDb>) {
  return {
    async list(workspaceId: string): Promise<(Selectable<BookmarkFolderRow> & { bookmark_count: number })[]> {
      const rows = await db
        .selectFrom("bookmark_folder")
        .leftJoin("bookmark", (j) => j.onRef("bookmark.folder_id", "=", "bookmark_folder.id"))
        .selectAll("bookmark_folder")
        .select((eb) => eb.fn.count("bookmark.id").as("bookmark_count"))
        .where("bookmark_folder.workspace_id", "=", workspaceId)
        .groupBy("bookmark_folder.id")
        .orderBy("bookmark_folder.created_at", "asc")
        .execute();
      return rows.map((r) => ({ ...r, bookmark_count: Number(r.bookmark_count) }));
    },

    async get(workspaceId: string, id: string): Promise<Selectable<BookmarkFolderRow> | undefined> {
      return db
        .selectFrom("bookmark_folder")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async create(input: { workspaceId: string; name: string; parentId?: string | null; createdBy: string | null }): Promise<Selectable<BookmarkFolderRow>> {
      return db
        .insertInto("bookmark_folder")
        .values({ id: ulid(), workspace_id: input.workspaceId, name: input.name, parent_id: input.parentId ?? null, created_by: input.createdBy })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async update(workspaceId: string, id: string, patch: { name?: string; parentId?: string | null }): Promise<Selectable<BookmarkFolderRow> | undefined> {
      return db
        .updateTable("bookmark_folder")
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.parentId !== undefined ? { parent_id: patch.parentId } : {}),
        })
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(workspaceId: string, id: string): Promise<boolean> {
      const res = await db
        .deleteFrom("bookmark_folder")
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
      return Number(res.numDeletedRows) > 0;
    },
  };
}

export function createBookmarksRepo(db: Kysely<TwoPinDb>) {
  return {
    /** `folderId` undefined = all bookmarks; "unfiled" = only folderless ones. */
    async list(workspaceId: string, folderId?: string | "unfiled"): Promise<Selectable<BookmarkRow>[]> {
      let q = db
        .selectFrom("bookmark")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .orderBy("created_at", "desc");
      if (folderId === "unfiled") q = q.where("folder_id", "is", null);
      else if (folderId) q = q.where("folder_id", "=", folderId);
      return q.execute();
    },

    async get(workspaceId: string, id: string): Promise<Selectable<BookmarkRow> | undefined> {
      return db
        .selectFrom("bookmark")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
    },

    async create(input: {
      workspaceId: string;
      folderId: string | null;
      url: string;
      title?: string | null;
      description?: string | null;
      favicon?: Buffer | null;
      faviconContentType?: string | null;
      createdBy: string | null;
    }): Promise<Selectable<BookmarkRow>> {
      return db
        .insertInto("bookmark")
        .values({
          id: ulid(),
          workspace_id: input.workspaceId,
          folder_id: input.folderId,
          url: input.url,
          title: input.title ?? null,
          description: input.description ?? null,
          favicon: input.favicon ?? null,
          favicon_content_type: input.faviconContentType ?? null,
          created_by: input.createdBy,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async update(
      workspaceId: string,
      id: string,
      patch: {
        folderId?: string | null;
        url?: string;
        title?: string | null;
        description?: string | null;
        favicon?: Buffer | null;
        faviconContentType?: string | null;
      },
    ): Promise<Selectable<BookmarkRow> | undefined> {
      return db
        .updateTable("bookmark")
        .set({
          ...(patch.folderId !== undefined ? { folder_id: patch.folderId } : {}),
          ...(patch.url !== undefined ? { url: patch.url } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.favicon !== undefined ? { favicon: patch.favicon } : {}),
          ...(patch.faviconContentType !== undefined ? { favicon_content_type: patch.faviconContentType } : {}),
        })
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(workspaceId: string, id: string): Promise<boolean> {
      const res = await db
        .deleteFrom("bookmark")
        .where("workspace_id", "=", workspaceId)
        .where("id", "=", id)
        .executeTakeFirst();
      return Number(res.numDeletedRows) > 0;
    },
  };
}

export function createSettingsRepo(db: Kysely<TwoPinDb>) {
  return {
    async get(workspaceId: string): Promise<{ defaultBoardId: string | null }> {
      const row = await db.selectFrom("workspace_settings").selectAll().where("workspace_id", "=", workspaceId).executeTakeFirst();
      return { defaultBoardId: row?.default_board_id ?? null };
    },

    async setDefaultBoard(workspaceId: string, boardId: string | null): Promise<void> {
      await db
        .insertInto("workspace_settings")
        .values({ workspace_id: workspaceId, default_board_id: boardId })
        .onConflict((oc) => oc.column("workspace_id").doUpdateSet({ default_board_id: boardId }))
        .execute();
    },
  };
}
