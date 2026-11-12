import { ulid } from "ulid";
import type { Kysely, Selectable } from "kysely";
import type { TwoPinDb, BoardRow, PinRow } from "./schema.js";

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
    async list(workspaceId: string, boardId?: string): Promise<Selectable<PinRow>[]> {
      let q = db
        .selectFrom("pin")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .orderBy("created_at", "desc");
      if (boardId) q = q.where("board_id", "=", boardId);
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
      url: string;
      note?: string | null;
      createdBy: string | null;
    }): Promise<Selectable<PinRow>> {
      return db
        .insertInto("pin")
        .values({
          id: ulid(),
          workspace_id: input.workspaceId,
          board_id: input.boardId,
          url: input.url,
          note: input.note ?? null,
          status: "pending",
          created_by: input.createdBy,
        })
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
      patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null; url?: string },
    ): Promise<Selectable<PinRow> | undefined> {
      return db
        .updateTable("pin")
        .set({
          ...(patch.boardId !== undefined ? { board_id: patch.boardId } : {}),
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          ...(patch.url !== undefined ? { url: patch.url } : {}),
        })
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
  };
}
