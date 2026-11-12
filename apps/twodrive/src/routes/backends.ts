import type { FastifyInstance } from "fastify";
import type { Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import type { TwoDriveDb, EntryRow } from "../db/schema.js";
import { encryptSecret } from "../crypto.js";
import { driverFromRawConfig, getStorageDriverAnyState, getStorageDriver } from "../storage/registry.js";
import { resolveVirtualStorage, usageOf, normalizePath } from "../lib/store.js";
import type { TwoDriveConfig } from "../config.js";
import { readForwardedContext, unauthorized, sendStoreError } from "../gateway-context.js";

// ---------------------------------------------------------------------------
// Backends + virtual storages. Routes defined in src/manifest.ts — keep the
// two in sync (paths, request/response shapes).
// ---------------------------------------------------------------------------

interface Ctx {
  db: Kysely<TwoDriveDb>;
  config: TwoDriveConfig;
  dataKey: string;
  /** workspace-level default virtual storage for app folders. */
  getDefaultVsId(workspaceId: string): Promise<string | null>;
  setDefaultVsId(id: string | null, workspaceId: string): Promise<void>;
}

export interface EntryDto {
  id: string;
  path: string;
  name: string;
  type: "file" | "folder";
  size: number;
  mimeType: string | null;
  previewType: string | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export function entryToDto(row: EntryRow): EntryDto {
  return {
    id: row.id,
    path: row.path,
    name: row.path.split("/").pop() ?? row.path,
    type: row.type as "file" | "folder",
    size: Number(row.size),
    mimeType: row.mime_type,
    previewType: row.preview_type,
    deleted: row.deleted_at != null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function backendDto(row: TwoDriveDb["drive_backend"]) {
  return {
    id: row.id,
    name: row.name,
    type: row.type as "s3" | "local",
    enabled: row.enabled,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const SECRET_FIELDS = ["secretAccessKey"];

/** Encrypts secret config fields; keeps non-secrets as-is. */
function encryptConfig(config: Record<string, unknown>, dataKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const field of SECRET_FIELDS) {
    if (typeof out[field] === "string" && out[field]) out[field] = encryptSecret(out[field] as string, dataKey);
  }
  return out;
}

/** Merges incoming config onto the stored one (secrets stay encrypted when omitted/empty). */
function mergeStoredConfig(stored: Record<string, unknown>, incoming: Record<string, unknown>, dataKey: string): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...stored };
  for (const [k, v] of Object.entries(incoming)) {
    if (SECRET_FIELDS.includes(k) && (v === "" || v == null)) continue; // keep existing secret
    merged[k] = v;
  }
  return merged;
}

export function registerBackendRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, dataKey } = ctx;

  // GET /backends — backends + all virtual storages in one call (the sidebar
  // tree builds itself from this).
  app.get("/backends", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const backends = await db
      .selectFrom("drive_backend")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .orderBy("name")
      .execute();
    const storages = await db
      .selectFrom("drive_virtual_storage")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .orderBy("name")
      .execute();

    const defaultVsId = await ctx.getDefaultVsId(auth.workspaceId);
    const storagesOut = [];
    for (const vs of storages) {
      storagesOut.push({
        id: vs.id,
        backendId: vs.backend_id,
        name: vs.name,
        prefix: vs.prefix,
        isDefault: vs.id === defaultVsId,
        usage: await usageOf(db, vs.id),
        createdAt: new Date(vs.created_at).toISOString(),
        updatedAt: new Date(vs.updated_at).toISOString(),
      });
    }
    return { backends: backends.map(backendDto), storages: storagesOut };
  });

  // POST /backends
  app.post("/backends", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const body = req.body as { name?: string; type?: string; config?: Record<string, unknown>; enabled?: boolean; test?: boolean };

    const name = body.name?.trim().toLowerCase();
    if (!name) return reply.code(400).send({ error: "name is required" });
    if (body.type !== "s3" && body.type !== "local") return reply.code(400).send({ error: "type must be s3 or local" });

    const dupe = await db
      .selectFrom("drive_backend")
      .select("id")
      .where("workspace_id", "=", auth.workspaceId)
      .where("name", "=", name)
      .executeTakeFirst();
    if (dupe) return reply.code(409).send({ error: "a backend with that name already exists" });

    // Validate + optionally test before storing anything.
    const rawConfig = body.config ?? {};
    try {
      const driver = driverFromRawConfig(body.type, rawConfig);
      if (body.test !== false) await driver.test();
    } catch (e) {
      return reply.code(400).send({ error: `backend test failed: ${(e as Error).message}` });
    }

    const now = new Date().toISOString();
    const row = {
      id: ulid(),
      workspace_id: auth.workspaceId,
      name,
      type: body.type,
      config: JSON.stringify(encryptConfig(rawConfig, dataKey)),
      enabled: body.enabled ?? true,
      created_at: now,
      updated_at: now,
    };
    await db.insertInto("drive_backend").values(row as never).execute();
    return backendDto(row);
  });

  // PATCH /backends/:id
  app.patch("/backends/:id", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; config?: Record<string, unknown>; enabled?: boolean };

    const existing = await db
      .selectFrom("drive_backend")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ error: "backend not found" });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name != null) patch.name = body.name.trim().toLowerCase();
    if (body.enabled != null) patch.enabled = body.enabled;
    if (body.config != null) {
      const merged = mergeStoredConfig(JSON.parse(existing.config), body.config, dataKey);
      try {
        const driver = driverFromRawConfig(existing.type as "s3" | "local", merged);
        await driver.test();
      } catch (e) {
        return reply.code(400).send({ error: `backend test failed: ${(e as Error).message}` });
      }
      patch.config = JSON.stringify(encryptConfig(merged, dataKey));
    }

    const updated = await db
      .updateTable("drive_backend")
      .set(patch)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    return backendDto(updated!);
  });

  // DELETE /backends/:id
  app.delete("/backends/:id", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { id } = req.params as { id: string };

    const existing = await db
      .selectFrom("drive_backend")
      .select("id")
      .where("workspace_id", "=", auth.workspaceId)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ error: "backend not found" });

    const dependent = await db
      .selectFrom("drive_virtual_storage")
      .select("name")
      .where("backend_id", "=", id)
      .executeTakeFirst();
    if (dependent) return reply.code(409).send({ error: `virtual storage "${dependent.name}" still lives on this backend` });

    await db.deleteFrom("drive_backend").where("id", "=", id).execute();
    return { ok: true };
  });

  // POST /backends/:id/test
  app.post("/backends/:id/test", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { id } = req.params as { id: string };
    try {
      const { driver } = await getStorageDriverAnyState(db, auth.workspaceId, id, dataKey);
      await driver.test();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
}

export function registerStorageRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, dataKey } = ctx;

  // POST /storages
  app.post("/storages", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const body = req.body as { name?: string; backendId?: string; prefix?: string; setAsDefault?: boolean };

    const name = body.name?.trim();
    if (!name) return reply.code(400).send({ error: "name is required" });
    const backend = await db
      .selectFrom("drive_backend")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .where((eb) => eb("id", "=", body.backendId ?? "").or("name", "=", body.backendId ?? ""))
      .executeTakeFirst();
    if (!backend || !backend.enabled) return reply.code(400).send({ error: "backend not found or disabled" });

    const dupe = await db
      .selectFrom("drive_virtual_storage")
      .select("id")
      .where("workspace_id", "=", auth.workspaceId)
      .where("name", "=", name)
      .executeTakeFirst();
    if (dupe) return reply.code(409).send({ error: "a virtual storage with that name already exists" });

    const prefix = body.prefix ? normalizePath(body.prefix) : name.toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
    // Prefix collisions between virtual storages on the same backend = data mixing.
    const prefixDupe = await db
      .selectFrom("drive_virtual_storage")
      .select("name")
      .where("backend_id", "=", backend.id)
      .where("prefix", "=", prefix)
      .executeTakeFirst();
    if (prefixDupe) {
      return reply.code(409).send({ error: `prefix "${prefix}" is already used by "${prefixDupe.name}" on this backend` });
    }

    const now = new Date().toISOString();
    const row = {
      id: ulid(),
      workspace_id: auth.workspaceId,
      backend_id: backend.id,
      name,
      prefix,
      created_at: now,
      updated_at: now,
    };
    await db.insertInto("drive_virtual_storage").values(row as never).execute();
    if (body.setAsDefault) await ctx.setDefaultVsId(row.id, auth.workspaceId);

    const { driver } = await getStorageDriver(db, auth.workspaceId, backend.id, dataKey);
    if (driver.mkdir) await driver.mkdir(prefix).catch(() => undefined);
    return {
      id: row.id,
      backendId: row.backend_id,
      name: row.name,
      prefix: row.prefix,
      isDefault: row.id === (await ctx.getDefaultVsId(auth.workspaceId)),
      usage: { used: 0, files: 0, folders: 0 },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  // PATCH /storages/:id
  app.patch("/storages/:id", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; setAsDefault?: boolean };

    const existing = await db
      .selectFrom("drive_virtual_storage")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ error: "virtual storage not found" });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name != null) {
      const name = body.name.trim();
      const dupe = await db
        .selectFrom("drive_virtual_storage")
        .select("id")
        .where("workspace_id", "=", auth.workspaceId)
        .where("name", "=", name)
        .where("id", "!=", id)
        .executeTakeFirst();
      if (dupe) return reply.code(409).send({ error: "a virtual storage with that name already exists" });
      patch.name = name;
    }
    const updated = await db
      .updateTable("drive_virtual_storage")
      .set(patch)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    if (body.setAsDefault === true) await ctx.setDefaultVsId(id, auth.workspaceId);
    return {
      id: updated!.id,
      backendId: updated!.backend_id,
      name: updated!.name,
      prefix: updated!.prefix,
      isDefault: updated!.id === (await ctx.getDefaultVsId(auth.workspaceId)),
      usage: await usageOf(db, id),
      createdAt: new Date(updated!.created_at).toISOString(),
      updatedAt: new Date(updated!.updated_at).toISOString(),
    };
  });

  // DELETE /storages/:id
  app.delete("/storages/:id", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { id } = req.params as { id: string };
    const query = req.query as { confirm?: string; hardDelete?: string };

    const existing = await db
      .selectFrom("drive_virtual_storage")
      .selectAll()
      .where("workspace_id", "=", auth.workspaceId)
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existing) return reply.code(404).send({ error: "virtual storage not found" });
    if (query.confirm !== "true") {
      return reply.code(400).send({ error: "confirm=true required — pass hardDelete=true as well to remove files from the backend" });
    }

    if (query.hardDelete === "true") {
      try {
        const resolved = await resolveVirtualStorage(db, auth.workspaceId, id, dataKey);
        await resolved.driver.delPrefix(existing.prefix);
      } catch (e) {
        return sendStoreError(reply, e);
      }
    }
    // Clear references: entries, access keys, share links, overrides, default.
    await db.deleteFrom("drive_entry").where("virtual_storage_id", "=", id).execute();
    await db.deleteFrom("drive_access_key").where("virtual_storage_id", "=", id).execute();
    await db.deleteFrom("drive_share_link").where("virtual_storage_id", "=", id).execute();
    await db.deleteFrom("drive_app_override").where("virtual_storage_id", "=", id).execute();
    if ((await ctx.getDefaultVsId(auth.workspaceId)) === id) await ctx.setDefaultVsId(null, auth.workspaceId);
    await db.deleteFrom("drive_virtual_storage").where("id", "=", id).execute();
    return { ok: true };
  });

  // GET /storages/default
  app.get("/storages/default", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    return { virtualStorageId: await ctx.getDefaultVsId(auth.workspaceId) };
  });

  // PUT /storages/default
  app.put("/storages/default", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const body = req.body as { virtualStorageId?: string | null };
    if (body.virtualStorageId) {
      const vs = await db
        .selectFrom("drive_virtual_storage")
        .select("id")
        .where("workspace_id", "=", auth.workspaceId)
        .where("id", "=", body.virtualStorageId)
        .executeTakeFirst();
      if (!vs) return reply.code(404).send({ error: "virtual storage not found" });
    }
    await ctx.setDefaultVsId(body.virtualStorageId ?? null, auth.workspaceId);
    return { virtualStorageId: body.virtualStorageId ?? null };
  });
}

export type { Ctx as StorageCtx };
