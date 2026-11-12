import type { FastifyInstance } from "fastify";
import type { Kysely } from "@twodb/core-data/db";
import type { TwoDriveDb } from "../db/schema.js";
import { resolveVirtualStorage, putFile, getFile, moveEntry, trashEntry, normalizePath, listFolder } from "../lib/store.js";
import { entryToDto } from "./backends.js";
import { readForwardedContext, readAppIdentifier, unauthorized, sendStoreError } from "../gateway-context.js";

interface Ctx {
  db: Kysely<TwoDriveDb>;
  dataKey: string;
  getDefaultVsId(workspaceId: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Internal app API — other apps put/get/patch their objects through this.
// Identity: x-twodb-app header (friendly identifier, e.g. "twomail"). Each
// app gets a dedicated folder <appId>/ inside the virtual storage chosen for
// it: per-app override first, then the workspace default. No default and no
// override → every call fails with 409 no_default_storage.
// ---------------------------------------------------------------------------

const NO_DEFAULT = "no_default_storage";

export async function resolveAppStorage(ctx: Ctx, workspaceId: string, appId: string) {
  const { db } = ctx;
  const override = await db
    .selectFrom("drive_app_override")
    .selectAll()
    .where("workspace_id", "=", workspaceId)
    .where("app_id", "=", appId)
    .executeTakeFirst();

  const vsId = override?.virtual_storage_id ?? (await ctx.getDefaultVsId(workspaceId));
  if (!vsId) {
    const err = new Error(`${NO_DEFAULT}: no default virtual storage is set and app "${appId}" has no override`);
    err.name = NO_DEFAULT;
    throw err;
  }

  const resolved = await resolveVirtualStorage(db, workspaceId, vsId, ctx.dataKey);
  // Every app's files live under its own folder inside the virtual storage.
  const appFolder = appId.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
  return { resolved, appFolder };
}

export function registerAppApiRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  const requireApp = async (req: Parameters<typeof readForwardedContext>[0]) => {
    const auth = readForwardedContext(req);
    if (!auth) return { auth: null } as const;
    const appId = readAppIdentifier(req);
    if (!appId) return { auth, appId: null } as const;
    return { auth, appId } as const;
  };

  // PUT /app/objects/* — insert/overwrite an object for the calling app.
  app.put("/app/objects/*", async (req, reply) => {
    const { auth, appId } = await requireApp(req);
    if (!auth) return unauthorized(reply);
    if (!appId) return reply.code(400).send({ error: "x-twodb-app header is required" });
    const { "*": filePath } = req.params as { "*": string };
    try {
      const rel = normalizePath(filePath);
      if (!rel) return reply.code(400).send({ error: "object path required" });
      // fastify's built-in text/plain parser yields a string; the wildcard
      // parser yields a Buffer. Accept both.
      const raw = req.body as Buffer | string | null;
      const body = typeof raw === "string" ? Buffer.from(raw) : raw;
      if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: "empty body" });

      const { resolved, appFolder } = await resolveAppStorage(ctx, auth.workspaceId, appId);
      const fullPath = `${appFolder}/${rel}`;
      const entry = await putFile(db, auth.workspaceId, resolved, fullPath, body, {
        mimeType: req.headers["content-type"] ?? undefined,
      });
      return { path: rel, fullPath, storageId: resolved.vs.id, size: Number(entry.size) };
    } catch (e) {
      if ((e as Error).name === NO_DEFAULT) return reply.code(409).send({ error: NO_DEFAULT, message: (e as Error).message });
      return sendStoreError(reply, e);
    }
  });

  // GET /app/objects/* — fetch an object (raw bytes).
  app.get("/app/objects/*", async (req, reply) => {
    const { auth, appId } = await requireApp(req);
    if (!auth) return unauthorized(reply);
    if (!appId) return reply.code(400).send({ error: "x-twodb-app header is required" });
    const { "*": filePath } = req.params as { "*": string };
    try {
      const rel = normalizePath(filePath);
      const { resolved, appFolder } = await resolveAppStorage(ctx, auth.workspaceId, appId);
      const res = await getFile(db, resolved, `${appFolder}/${rel}`);
      reply.header("content-type", res.contentType ?? "application/octet-stream");
      return reply.send(res.body);
    } catch (e) {
      if ((e as Error).name === NO_DEFAULT) return reply.code(409).send({ error: NO_DEFAULT, message: (e as Error).message });
      return sendStoreError(reply, e);
    }
  });

  // PATCH /app/objects/* — move/rename an object ({to: "new/relative/path"}).
  app.patch("/app/objects/*", async (req, reply) => {
    const { auth, appId } = await requireApp(req);
    if (!auth) return unauthorized(reply);
    if (!appId) return reply.code(400).send({ error: "x-twodb-app header is required" });
    const { "*": filePath } = req.params as { "*": string };
    const body = req.body as { to?: string };
    try {
      if (!body.to) return reply.code(400).send({ error: "body.to is required" });
      const rel = normalizePath(filePath);
      const to = normalizePath(body.to);
      const { resolved, appFolder } = await resolveAppStorage(ctx, auth.workspaceId, appId);
      await moveEntry(db, auth.workspaceId, resolved, `${appFolder}/${rel}`, `${appFolder}/${to}`);
      return { path: to, fullPath: `${appFolder}/${to}` };
    } catch (e) {
      if ((e as Error).name === NO_DEFAULT) return reply.code(409).send({ error: NO_DEFAULT, message: (e as Error).message });
      return sendStoreError(reply, e);
    }
  });

  // DELETE /app/objects/* — trash an object.
  app.delete("/app/objects/*", async (req, reply) => {
    const { auth, appId } = await requireApp(req);
    if (!auth) return unauthorized(reply);
    if (!appId) return reply.code(400).send({ error: "x-twodb-app header is required" });
    const { "*": filePath } = req.params as { "*": string };
    try {
      const rel = normalizePath(filePath);
      const { resolved, appFolder } = await resolveAppStorage(ctx, auth.workspaceId, appId);
      await trashEntry(db, resolved, `${appFolder}/${rel}`);
      return { ok: true };
    } catch (e) {
      if ((e as Error).name === NO_DEFAULT) return reply.code(409).send({ error: NO_DEFAULT, message: (e as Error).message });
      return sendStoreError(reply, e);
    }
  });

  // GET /app/objects — list the app's folder.
  app.get("/app/objects", async (req, reply) => {
    const { auth, appId } = await requireApp(req);
    if (!auth) return unauthorized(reply);
    if (!appId) return reply.code(400).send({ error: "x-twodb-app header is required" });
    const query = req.query as { prefix?: string; recursive?: string };
    try {
      const { resolved, appFolder } = await resolveAppStorage(ctx, auth.workspaceId, appId);
      const base = appFolder + (query.prefix ? `/${normalizePath(query.prefix)}` : "");
      if (query.recursive === "true") {
        const rows = await db
          .selectFrom("drive_entry")
          .selectAll()
          .where("virtual_storage_id", "=", resolved.vs.id)
          .where("path", "like", `${base}/%`)
          .where("deleted_at", "is", null)
          .execute();
        const prefixLen = base.length + 1;
        return {
          entries: rows.map((r) => ({
            path: r.path.slice(prefixLen),
            type: r.type,
            size: Number(r.size),
            updatedAt: new Date(r.updated_at).toISOString(),
          })),
        };
      }
      const rows = await listFolder(db, resolved, { path: base });
      const prefixLen = base.length + 1;
      return {
        entries: rows.map((r) => ({
          path: r.path.slice(prefixLen),
          type: r.type as "file" | "folder",
          size: Number(r.size),
          updatedAt: new Date(r.updated_at).toISOString(),
        })),
      };
    } catch (e) {
      if ((e as Error).name === NO_DEFAULT) return reply.code(409).send({ error: NO_DEFAULT, message: (e as Error).message });
      return sendStoreError(reply, e);
    }
  });

  // GET /app — the calling app's effective storage mapping (debug-friendly).
  app.get("/app", async (req, reply) => {
    const { auth, appId } = await requireApp(req);
    if (!auth) return unauthorized(reply);
    if (!appId) return reply.code(400).send({ error: "x-twodb-app header is required" });
    try {
      const { resolved, appFolder } = await resolveAppStorage(ctx, auth.workspaceId, appId);
      return { appId, storageId: resolved.vs.id, storageName: resolved.vs.name, folder: appFolder };
    } catch (e) {
      if ((e as Error).name === NO_DEFAULT) return reply.code(409).send({ error: NO_DEFAULT, message: (e as Error).message });
      return sendStoreError(reply, e);
    }
  });
}

export function registerAppOverrideRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  // GET /app-overrides
  app.get("/app-overrides", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const rows = await db
      .selectFrom("drive_app_override")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .where("app_id", "!=", "__default__")
      .orderBy("app_id")
      .execute();
    return {
      overrides: rows.map((r) => ({
        id: r.id,
        appId: r.app_id,
        virtualStorageId: r.virtual_storage_id,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    };
  });

  // PUT /app-overrides/:appId
  app.put("/app-overrides/:appId", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { appId } = req.params as { appId: string };
    const body = req.body as { virtualStorageId?: string | null };
    const cleanAppId = appId.trim().toLowerCase();
    if (!cleanAppId) return reply.code(400).send({ error: "appId is required" });

    if (body.virtualStorageId) {
      const vs = await db
        .selectFrom("drive_virtual_storage")
        .select("id")
        .where("workspace_id", "=", auth.workspaceId)
        .where("id", "=", body.virtualStorageId)
        .executeTakeFirst();
      if (!vs) return reply.code(404).send({ error: "virtual storage not found" });
    }

    const existing = await db
      .selectFrom("drive_app_override")
      .select("id")
      .where("workspace_id", "=", auth.workspaceId)
      .where("app_id", "=", cleanAppId)
      .executeTakeFirst();

    if (body.virtualStorageId) {
      if (existing) {
        await db
          .updateTable("drive_app_override")
          .set({ virtual_storage_id: body.virtualStorageId, updated_at: new Date().toISOString() })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("drive_app_override")
          .values({
            id: (await import("ulid")).ulid(),
            workspace_id: auth.workspaceId,
            app_id: cleanAppId,
            virtual_storage_id: body.virtualStorageId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as never)
          .execute();
      }
    } else if (existing) {
      // null clears the override.
      await db.deleteFrom("drive_app_override").where("id", "=", existing.id).execute();
    }
    return { ok: true };
  });
}

export { entryToDto };
