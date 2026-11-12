import type { FastifyInstance } from "fastify";
import { ulid } from "ulid";
import { z } from "zod";
import { logActivity, readActivity } from "../lib/activity.js";
import { generateCodes } from "../lib/code-pool.js";
import { itemDto, resolveLabel } from "../lib/items.js";
import { LocationTree } from "../lib/locations.js";
import { HttpError } from "../gateway-context.js";
import { authed, type Ctx } from "./context.js";

const locationInput = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.string().trim().max(30).optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().max(4000).optional(),
  color: z.string().max(30).nullable().optional(),
  imageId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  autoCode: z.boolean().optional(),
});
const locationPatch = locationInput.partial();

export function registerLocationRoutes(app: FastifyInstance, { db }: Ctx) {
  app.get(
    "/locations",
    authed(async ({ workspaceId: ws }) => {
      const tree = await LocationTree.load(db, ws, true);
      const unplaced = await db
        .selectFrom("tt_item")
        .select((eb) => eb.fn.countAll<number>().as("n"))
        .where("workspace_id", "=", ws)
        .where("location_id", "is", null)
        .executeTakeFirst();
      return { locations: tree.ordered(), unplacedCount: Number(unplaced?.n ?? 0) };
    }),
  );

  app.post(
    "/locations",
    authed(async ({ workspaceId: ws, userId }, req, reply) => {
      const input = locationInput.parse(req.body);
      const tree = await LocationTree.load(db, ws);
      if (input.parentId && !tree.byId.has(input.parentId)) throw new HttpError(400, "parent_not_found");
      let code = await resolveLabel(db, ws, input.code);
      if (!code && input.autoCode) code = (await generateCodes(db, ws, 1, { batch: false })).codes[0];
      const now = new Date();
      const row = {
        id: ulid(),
        workspace_id: ws,
        code: code ?? null,
        name: input.name,
        kind: input.kind || "box",
        parent_id: input.parentId ?? null,
        description: input.description ?? "",
        color: input.color ?? null,
        image_id: input.imageId ?? null,
        created_at: now,
        updated_at: now,
      };
      await db.insertInto("tt_location").values(row).execute();
      await logActivity(db, ws, userId, { targetKind: "location", targetId: row.id, targetName: row.name, action: "created", detail: { kind: row.kind, parent: tree.pathText(row.parent_id) || null } });
      const fresh = await LocationTree.load(db, ws, true);
      return reply.code(201).send(fresh.toDto(row));
    }),
  );

  app.get(
    "/locations/:id",
    authed<{ id: string }>(async ({ workspaceId: ws }, req) => {
      const tree = await LocationTree.load(db, ws, true);
      const row = tree.byId.get(req.params.id);
      if (!row) throw new HttpError(404, "location_not_found");
      const items = await db
        .selectFrom("tt_item")
        .selectAll()
        .where("workspace_id", "=", ws)
        .where("location_id", "=", row.id)
        .orderBy("name")
        .execute();
      return {
        location: tree.toDto(row),
        children: (tree.children.get(row.id) ?? []).map((c) => tree.toDto(c)),
        items: items.map((i) => itemDto(i, tree)),
        activity: await readActivity(db, ws, { target: row.id, limit: 20 }),
      };
    }),
  );

  app.patch(
    "/locations/:id",
    authed<{ id: string }>(async ({ workspaceId: ws, userId }, req) => {
      const patch = locationPatch.parse(req.body);
      const tree = await LocationTree.load(db, ws, true);
      const prev = tree.byId.get(req.params.id);
      if (!prev) throw new HttpError(404, "location_not_found");
      const set: Record<string, unknown> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.kind !== undefined) set.kind = patch.kind || "box";
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.color !== undefined) set.color = patch.color;
      if (patch.imageId !== undefined) set.image_id = patch.imageId;
      if (patch.parentId !== undefined && patch.parentId !== prev.parent_id) {
        if (patch.parentId) {
          if (!tree.byId.has(patch.parentId)) throw new HttpError(400, "parent_not_found");
          if (tree.descendants(prev.id).includes(patch.parentId)) throw new HttpError(400, "cycle", { message: "Can't put a place inside itself." });
        }
        set.parent_id = patch.parentId;
      }
      if (patch.code !== undefined || patch.autoCode) {
        let code = await resolveLabel(db, ws, patch.code, { kind: "location", id: prev.id });
        if (!code && patch.autoCode) code = (await generateCodes(db, ws, 1, { batch: false })).codes[0];
        if (code !== undefined && code !== prev.code) set.code = code;
      }
      if (Object.keys(set).length) {
        set.updated_at = new Date();
        await db.updateTable("tt_location").set(set as never).where("id", "=", prev.id).where("workspace_id", "=", ws).execute();
        const action = "parent_id" in set ? "moved" : "code" in set && Object.keys(set).length === 2 ? "labeled" : "updated";
        await logActivity(db, ws, userId, {
          targetKind: "location",
          targetId: prev.id,
          targetName: (set.name as string) ?? prev.name,
          action,
          detail:
            action === "moved"
              ? { from: tree.pathText(prev.parent_id) || null, to: tree.pathText(set.parent_id as string | null) || null }
              : { fields: Object.keys(set).filter((k) => k !== "updated_at") },
        });
      }
      const fresh = await LocationTree.load(db, ws, true);
      return fresh.toDto(fresh.byId.get(prev.id)!);
    }),
  );

  /** Delete a place. Non-empty places need ?contents=parent (re-home children + items one level up). */
  app.delete(
    "/locations/:id",
    authed<{ id: string }, { contents?: string }>(async ({ workspaceId: ws, userId }, req) => {
      const tree = await LocationTree.load(db, ws, true);
      const row = tree.byId.get(req.params.id);
      if (!row) throw new HttpError(404, "location_not_found");
      const dto = tree.toDto(row);
      if ((dto.childCount > 0 || dto.itemCount > 0) && req.query.contents !== "parent") {
        throw new HttpError(409, "location_not_empty", { childCount: dto.childCount, itemCount: dto.itemCount });
      }
      await db.transaction().execute(async (trx) => {
        await trx.updateTable("tt_location").set({ parent_id: row.parent_id }).where("workspace_id", "=", ws).where("parent_id", "=", row.id).execute();
        await trx.updateTable("tt_item").set({ location_id: row.parent_id }).where("workspace_id", "=", ws).where("location_id", "=", row.id).execute();
        await trx.deleteFrom("tt_location").where("id", "=", row.id).where("workspace_id", "=", ws).execute();
      });
      await logActivity(db, ws, userId, { targetKind: "location", targetId: row.id, targetName: row.name, action: "deleted", detail: { code: row.code } });
      return { ok: true };
    }),
  );
}
