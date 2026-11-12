import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { readActivity } from "../lib/activity.js";
import {
  adjustQuantity,
  createItem,
  deleteItem,
  getItemRow,
  itemDto,
  itemInput,
  itemPatch,
  listItems,
  listTags,
  moveItems,
  updateItem,
} from "../lib/items.js";
import { LocationTree } from "../lib/locations.js";
import { authed, flag, type Ctx } from "./context.js";

const adjustBody = z.object({ delta: z.number().finite().optional(), set: z.number().finite().min(0).optional(), reason: z.string().max(500).optional() });
const moveBody = z.object({ itemIds: z.array(z.string()).min(1).max(1000), locationId: z.string().nullable() });

export function registerItemRoutes(app: FastifyInstance, { db }: Ctx) {
  app.get(
    "/items",
    authed<Record<string, string>, Record<string, string | undefined>>(async ({ workspaceId: ws }, req) => {
      const q = req.query;
      const tree = await LocationTree.load(db, ws);
      const items = await listItems(
        db,
        ws,
        {
          q: q.q,
          category: q.category || undefined,
          locationId: q.locationId || undefined,
          recursive: q.recursive === undefined ? true : flag(q.recursive),
          tag: q.tag || undefined,
          low: flag(q.low),
          unplaced: flag(q.unplaced),
          favorite: flag(q.favorite),
          sort: (q.sort as never) || undefined,
          limit: q.limit ? Number(q.limit) : undefined,
        },
        tree,
      );
      return { items };
    }),
  );

  app.post(
    "/items",
    authed(async ({ workspaceId: ws, userId }, req, reply) => {
      const input = itemInput.parse(req.body);
      const row = await createItem(db, ws, userId, input);
      const tree = await LocationTree.load(db, ws);
      return reply.code(201).send(itemDto(row, tree));
    }),
  );

  app.get(
    "/items/:id",
    authed<{ id: string }>(async ({ workspaceId: ws }, req) => {
      const row = await getItemRow(db, ws, req.params.id);
      const tree = await LocationTree.load(db, ws);
      const activity = await readActivity(db, ws, { target: row.id, limit: 30 });
      return { item: itemDto(row, tree), activity };
    }),
  );

  app.patch(
    "/items/:id",
    authed<{ id: string }>(async ({ workspaceId: ws, userId }, req) => {
      const patch = itemPatch.parse(req.body);
      const tree = await LocationTree.load(db, ws);
      const row = await updateItem(db, ws, userId, req.params.id, patch, tree);
      return itemDto(row, tree);
    }),
  );

  app.delete(
    "/items/:id",
    authed<{ id: string }>(async ({ workspaceId: ws, userId }, req) => {
      await deleteItem(db, ws, userId, req.params.id);
      return { ok: true };
    }),
  );

  app.post(
    "/items/:id/adjust",
    authed<{ id: string }>(async ({ workspaceId: ws, userId }, req) => {
      const body = adjustBody.parse(req.body);
      const row = await adjustQuantity(db, ws, userId, req.params.id, body);
      return itemDto(row, await LocationTree.load(db, ws));
    }),
  );

  app.post(
    "/items/move",
    authed(async ({ workspaceId: ws, userId }, req) => {
      const body = moveBody.parse(req.body);
      const tree = await LocationTree.load(db, ws);
      return { moved: await moveItems(db, ws, userId, body.itemIds, body.locationId, tree) };
    }),
  );

  app.get(
    "/tags",
    authed(async ({ workspaceId: ws }) => ({ tags: await listTags(db, ws) })),
  );
}
