import type { FastifyInstance } from "fastify";
import type { Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import type { TwoDriveDb } from "../db/schema.js";
import {
  resolveVirtualStorage,
  listFolder,
  putFile,
  getFile,
  mkdir,
  trashEntry,
  restoreEntry,
  purgeEntry,
  emptyTrash,
  moveEntry,
  copyEntry,
  renameEntry,
  searchEntries,
  normalizePath,
  joinPath,
  backendKey,
} from "../lib/store.js";
import { entryToDto } from "./backends.js";
import { readForwardedContext, unauthorized, sendStoreError } from "../gateway-context.js";

interface Ctx {
  db: Kysely<TwoDriveDb>;
  config: { HTTP_URL: string };
  dataKey: string;
  getDefaultVsId(workspaceId: string): Promise<string | null>;
  setDefaultVsId(id: string | null, workspaceId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Explorer — browse/manage files inside one virtual storage. The central
// entry table is the source of truth (backends are never listed directly).
// ---------------------------------------------------------------------------

export function registerExplorerRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, dataKey } = ctx;

  const resolve = async (req: Parameters<typeof readForwardedContext>[0], storageId: string) => {
    const auth = readForwardedContext(req);
    if (!auth) return { auth: null, resolved: null } as const;
    try {
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      return { auth, resolved } as const;
    } catch (e) {
      return { auth, resolved: null, error: e } as const;
    }
  };

  // GET /storages/:storageId/entries — one-level folder listing (or the
  // whole trash tree when trash=true: trashed entries from any depth).
  app.get("/storages/:storageId/entries", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const query = req.query as { path?: string; trash?: string };
    try {
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      if (query.trash === "true") {
        const rows = await db
          .selectFrom("drive_entry")
          .selectAll()
          .where("virtual_storage_id", "=", resolved.vs.id)
          .where("deleted_at", "is not", null)
          .orderBy("path")
          .execute();
        return { entries: rows.map(entryToDto) };
      }
      const rows = await listFolder(db, resolved, { path: query.path ?? "" });
      return { entries: rows.map(entryToDto) };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/folders
  app.post("/storages/:storageId/folders", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { path?: string };
    try {
      if (!body.path?.trim()) return reply.code(400).send({ error: "path is required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const entry = await mkdir(db, auth.workspaceId, resolved, body.path);
      return entryToDto(entry);
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/files?path=dir/name.ext — raw-body upload.
  app.post("/storages/:storageId/files", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const query = req.query as { path?: string };
    try {
      if (!query.path) return reply.code(400).send({ error: "?path= is required (includes the file name)" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      // fastify's built-in text/plain parser yields a string; the wildcard
      // parser yields a Buffer. Accept both.
      const raw = req.body as Buffer | string | null;
      const body = typeof raw === "string" ? Buffer.from(raw) : raw;
      if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: "empty body" });
      const entry = await putFile(db, auth.workspaceId, resolved, query.path, body, {
        mimeType: (req.headers["content-type"] ?? undefined) ?? undefined,
      });
      return entryToDto(entry);
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // GET /storages/:storageId/files/* — download (streamed, range-capable).
  app.get("/storages/:storageId/files/*", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId, "*": filePath } = req.params as { storageId: string; "*": string };
    const query = req.query as { download?: string };
    try {
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const clean = normalizePath(filePath);
      const entry = await db
        .selectFrom("drive_entry")
        .selectAll()
        .where("virtual_storage_id", "=", resolved.vs.id)
        .where("path", "=", clean)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      if (!entry || entry.type !== "file") return reply.code(404).send({ error: "file not found" });
      const name = clean.split("/").pop() ?? clean;
      reply.header("content-type", entry.mime_type ?? "application/octet-stream");
      if (query.download === "1") reply.header("content-disposition", `attachment; filename="${name}"`);
      if (resolved.driver.stream) {
        const stream = await resolved.driver.stream(backendKey(resolved.vs, clean));
        if (stream) return reply.send(stream);
      }
      const res = await getFile(db, resolved, clean);
      return reply.send(res.body);
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // PATCH /storages/:storageId/entries/rename
  app.patch("/storages/:storageId/entries/rename", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { path?: string; newName?: string };
    try {
      if (!body.path || !body.newName?.trim()) return reply.code(400).send({ error: "path and newName are required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      await renameEntry(db, auth.workspaceId, resolved, body.path, body.newName.trim());
      const renamed = await db
        .selectFrom("drive_entry")
        .selectAll()
        .where("virtual_storage_id", "=", resolved.vs.id)
        .where("path", "=", joinPath(normalizePath(body.path).split("/").slice(0, -1).join("/"), body.newName.trim()))
        .execute();
      return renamed[0] ? entryToDto(renamed[0]) : { ok: true };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // PATCH /storages/:storageId/entries/move
  app.patch("/storages/:storageId/entries/move", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { from?: string; to?: string };
    try {
      if (!body.from || !body.to) return reply.code(400).send({ error: "from and to are required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      await moveEntry(db, auth.workspaceId, resolved, body.from, body.to);
      return { ok: true };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/entries/copy
  app.post("/storages/:storageId/entries/copy", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { from?: string; to?: string };
    try {
      if (!body.from || !body.to) return reply.code(400).send({ error: "from and to are required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      await copyEntry(db, auth.workspaceId, resolved, body.from, body.to);
      return { ok: true };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/entries/trash
  app.post("/storages/:storageId/entries/trash", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { paths?: string[] };
    try {
      if (!body.paths?.length) return reply.code(400).send({ error: "paths array is required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      for (const p of body.paths) await trashEntry(db, resolved, p);
      return { ok: true };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/entries/restore
  app.post("/storages/:storageId/entries/restore", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { entryIds?: string[] };
    try {
      if (!body.entryIds?.length) return reply.code(400).send({ error: "entryIds array is required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      for (const id of body.entryIds) await restoreEntry(db, resolved, id);
      return { ok: true };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/entries/purge
  app.post("/storages/:storageId/entries/purge", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { paths?: string[] };
    try {
      if (!body.paths?.length) return reply.code(400).send({ error: "paths array is required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      let deleted = 0;
      for (const p of body.paths) deleted += await purgeEntry(db, resolved, p);
      return { ok: true, deleted };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // POST /storages/:storageId/trash/empty
  app.post("/storages/:storageId/trash/empty", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    try {
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const deleted = await emptyTrash(db, resolved);
      return { ok: true, deleted };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // GET /storages/:storageId/search
  app.get("/storages/:storageId/search", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const query = req.query as { query?: string; limit?: string };
    try {
      if (!query.query) return reply.code(400).send({ error: "?query= is required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const rows = await searchEntries(db, resolved, { query: query.query, limit: query.limit ? Number(query.limit) : undefined });
      return { entries: rows.map(entryToDto) };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // GET /storages/:storageId/recent
  app.get("/storages/:storageId/recent", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const query = req.query as { limit?: string };
    try {
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const rows = await db
        .selectFrom("drive_entry")
        .selectAll()
        .where("virtual_storage_id", "=", resolved.vs.id)
        .where("type", "=", "file")
        .where("deleted_at", "is", null)
        .orderBy("updated_at", "desc")
        .limit(query.limit ? Number(query.limit) : 8)
        .execute();
      return { entries: rows.map(entryToDto) };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // --- share links ---------------------------------------------------------

  // POST /storages/:storageId/shares
  app.post("/storages/:storageId/shares", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = req.body as { path?: string; expiresAt?: string | null };
    try {
      if (!body.path) return reply.code(400).send({ error: "path is required" });
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const clean = normalizePath(body.path);
      const entry = await db
        .selectFrom("drive_entry")
        .selectAll()
        .where("virtual_storage_id", "=", resolved.vs.id)
        .where("path", "=", clean)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      if (!entry) return reply.code(404).send({ error: "entry not found" });

      const token = ulid().toLowerCase();
      await db
        .insertInto("drive_share_link")
        .values({
          id: ulid(),
          workspace_id: auth.workspaceId,
          virtual_storage_id: resolved.vs.id,
          entry_id: entry.id,
          token,
          expires_at: body.expiresAt ? new Date(body.expiresAt) : null,
          created_at: new Date(),
        } as never)
        .execute();
      const base = ctx.config.HTTP_URL.replace(/\/$/, "");
      return { token, url: `${base}/shares/${token}`, expiresAt: body.expiresAt ?? null };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // GET /storages/:storageId/shares
  app.get("/storages/:storageId/shares", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    try {
      const resolved = await resolveVirtualStorage(db, auth.workspaceId, storageId, dataKey);
      const shares = await db
        .selectFrom("drive_share_link")
        .innerJoin("drive_entry", "drive_entry.id", "drive_share_link.entry_id")
        .select(["drive_share_link.id", "drive_share_link.token", "drive_share_link.expires_at", "drive_share_link.created_at", "drive_entry.path"])
        .where("drive_share_link.virtual_storage_id", "=", resolved.vs.id)
        .execute();
      return {
        shares: shares.map((s) => ({
          id: s.id,
          token: s.token,
          path: s.path,
          entryId: "",
          expiresAt: s.expires_at ? new Date(s.expires_at).toISOString() : null,
          createdAt: new Date(s.created_at).toISOString(),
        })),
      };
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });

  // DELETE /storages/:storageId/shares/:token
  app.delete("/storages/:storageId/shares/:token", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId, token } = req.params as { storageId: string; token: string };
    await db
      .deleteFrom("drive_share_link")
      .where("virtual_storage_id", "=", storageId)
      .where("token", "=", token)
      .execute();
    return { ok: true };
  });
}
