import type { FastifyInstance } from "fastify";
import type { Kysely } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { randomBytes } from "node:crypto";
import type { TwoDriveDb } from "../db/schema.js";
import { sha256 } from "../crypto.js";
import { resolveVirtualStorage, putFile, getFile, trashEntry, purgeEntry } from "../lib/store.js";
import { readForwardedContext, unauthorized, sendStoreError } from "../gateway-context.js";

interface Ctx {
  db: Kysely<TwoDriveDb>;
  config: { HTTP_URL: string };
  dataKey: string;
  getDefaultVsId(workspaceId: string): Promise<string | null>;
  setDefaultVsId(id: string | null, workspaceId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// S3-compatible surface per virtual storage — /s3/:storageId/*
// Simplified auth (chosen deliberately for v1, NOT SigV4-compatible):
//   - header `x-amz-access-key-id` + `x-amz-secret`  (simplest)
//   - or Authorization: AWS <accessKeyId>:<secret>
//   - or query ?accessKeyId=...&secret=... (curl-friendly)
// Ops: GET bucket (list), GET/HEAD/PUT/DELETE object.
// ---------------------------------------------------------------------------

function extractCredentials(req: Parameters<typeof readForwardedContext>[0]): { accessKeyId: string; secret: string } | null {
  const h = req.headers;
  const id = (h["x-amz-access-key-id"] as string | undefined) ?? (h["x-amz-key"] as string | undefined);
  const secret = (h["x-amz-secret"] as string | undefined) ?? (h["x-amz-secret-key"] as string | undefined);
  if (id && secret) return { accessKeyId: id, secret };

  const auth = h["authorization"] as string | undefined;
  if (auth?.startsWith("AWS ")) {
    const [accessKeyId, ...rest] = auth.slice(4).trim().split(":");
    const sec = rest.join(":");
    if (accessKeyId && sec) return { accessKeyId, secret: sec };
  }

  const query = req.query as Record<string, string | undefined>;
  if (query.accessKeyId && query.secret) return { accessKeyId: query.accessKeyId, secret: query.secret };
  return null;
}

/** Verifies access-key credentials against a virtual storage. Returns false on any mismatch. */
async function verifyAccessKey(ctx: Ctx, storageId: string, creds: { accessKeyId: string; secret: string }): Promise<boolean> {
  const row = await ctx.db
    .selectFrom("drive_access_key")
    .selectAll()
    .where("virtual_storage_id", "=", storageId)
    .where("access_key_id", "=", creds.accessKeyId)
    .executeTakeFirst();
  if (!row) return false;
  if (row.secret_hash !== sha256(creds.secret)) return false;
  // Fire-and-forget usage timestamp.
  void ctx.db
    .updateTable("drive_access_key")
    .set({ last_used_at: new Date().toISOString() })
    .where("id", "=", row.id)
    .execute()
    .catch(() => undefined);
  return true;
}

function s3Error(reply: Parameters<typeof sendStoreError>[0], code: string, message: string, status: number) {
  return reply.code(status).type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${code}</Code><Message>${message}</Message></Error>`,
  );
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function registerS3Routes(app: FastifyInstance, ctx: Ctx) {
  const { db, dataKey } = ctx;

  // Auth is workspace-independent on this surface — the access key IS the
  // credential (it scopes to exactly one virtual storage). Two route shapes
  // share one handler: /s3/:id (bucket-level) and /s3/:id/* (object-level).
  const handler = async (req: Parameters<typeof readForwardedContext>[0], reply: Parameters<typeof sendStoreError>[0]) => {
    const params = req.params as { storageId?: string; "*": string };
    const storageId = params.storageId!;
    const key = params["*"] ?? "";
    const query = (req.query ?? {}) as Record<string, string | undefined>;

    const creds = extractCredentials(req);
    if (!creds) return s3Error(reply, "AccessDenied", "Missing access key credentials", 403);
    if (!(await verifyAccessKey(ctx, storageId, creds))) return s3Error(reply, "AccessDenied", "Invalid access key or secret", 403);

    let resolved;
    try {
      resolved = await resolveVirtualStorage(db, (await lookupWorkspace(ctx, storageId)) ?? "", storageId, dataKey);
    } catch {
      return s3Error(reply, "NoSuchBucket", "Virtual storage not found", 404);
    }

    // GET bucket = list objects (key path empty or explicit list-type).
    if (req.method === "GET" && (!key || query["list-type"] === "2" || query.prefix !== undefined || key === "")) {
      const prefix = query.prefix ?? "";
      const rows = await db
        .selectFrom("drive_entry")
        .selectAll()
        .where("virtual_storage_id", "=", resolved.vs.id)
        .where("path", "like", `${prefix}%`)
        .where("deleted_at", "is", null)
        .orderBy("path")
        .execute();
      const contents = rows
        .filter((r) => r.type === "file")
        .map(
          (r) =>
            `    <Contents>\n      <Key>${xmlEscape(r.path)}</Key>\n      <LastModified>${new Date(r.updated_at).toISOString()}</LastModified>\n      <Size>${Number(r.size)}</Size>\n      <ETag>${xmlEscape(r.etag ?? "")}</ETag>\n    </Contents>`,
        )
        .join("\n");
      return reply
        .code(200)
        .type("application/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<ListBucketResult>\n  <Name>${xmlEscape(resolved.vs.name)}</Name>\n  <Prefix>${xmlEscape(prefix)}</Prefix>\n  <KeyCount>${rows.filter((r) => r.type === "file").length}</KeyCount>\n${contents}\n</ListBucketResult>`,
        );
    }

    // Object operations — key must exist.
    if (!key) return s3Error(reply, "InvalidRequest", "Object key required", 400);

    if (req.method === "PUT") {
      try {
        // fastify's built-in text/plain parser yields a string; the wildcard
        // parser yields a Buffer. Accept both.
        const raw = req.body as Buffer | string | null;
        const body = typeof raw === "string" ? Buffer.from(raw) : raw;
        if (!Buffer.isBuffer(body) || body.length === 0) return s3Error(reply, "InvalidRequest", "Empty body", 400);
        const entry = await putFile(db, resolved.vs.workspace_id, resolved, key, body, {
          mimeType: (req.headers["content-type"] as string | undefined) ?? undefined,
        });
        reply.header("etag", `"${entry.etag ?? ""}"`);
        return reply.code(200).send();
      } catch (e) {
        return s3Error(reply, "InternalError", (e as Error).message, 500);
      }
    }

    if (req.method === "GET" || req.method === "HEAD") {
      try {
        const res = await getFile(db, resolved, key);
        reply.header("content-type", res.contentType ?? "application/octet-stream");
        reply.header("content-length", res.body.length);
        reply.header("etag", `"${res.entry.etag ?? ""}"`);
        if (req.method === "HEAD") return reply.code(200).send();
        return reply.send(res.body);
      } catch {
        return s3Error(reply, "NoSuchKey", "The specified key does not exist", 404);
      }
    }

    if (req.method === "DELETE") {
      try {
        await trashEntry(db, resolved, key);
        return reply.code(204).send();
      } catch (e) {
        return s3Error(reply, "InternalError", (e as Error).message, 500);
      }
    }

    return s3Error(reply, "MethodNotAllowed", `Method ${req.method} not supported in v1`, 405);
  };

  app.all("/s3/:storageId/*", handler);
  app.all("/s3/:storageId", handler);
}

/** The S3 surface is credential-scoped, not gateway-auth-scoped — resolves the workspace through the storage row. */
async function lookupWorkspace(ctx: Ctx, storageId: string): Promise<string | null> {
  const row = await ctx.db
    .selectFrom("drive_virtual_storage")
    .select("workspace_id")
    .where("id", "=", storageId)
    .executeTakeFirst();
  return row?.workspace_id ?? null;
}

// --- access key management (authed, per virtual storage) ---------------------

export function registerAccessKeyRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  app.get("/storages/:storageId/keys", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const rows = await db
      .selectFrom("drive_access_key")
      .selectAll()
      .where("virtual_storage_id", "=", storageId)
      .where("workspace_id", "=", auth.workspaceId)
      .orderBy("created_at")
      .execute();
    return {
      keys: rows.map((r) => ({
        id: r.id,
        accessKeyId: r.access_key_id,
        label: r.label,
        createdAt: new Date(r.created_at).toISOString(),
        lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
      })),
    };
  });

  app.post("/storages/:storageId/keys", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId } = req.params as { storageId: string };
    const body = (req.body ?? {}) as { label?: string };

    const vs = await db
      .selectFrom("drive_virtual_storage")
      .select("id")
      .where("workspace_id", "=", auth.workspaceId)
      .where("id", "=", storageId)
      .executeTakeFirst();
    if (!vs) return reply.code(404).send({ error: "virtual storage not found" });

    const accessKeyId = `TD${ulid().toLowerCase()}`;
    const secretAccessKey = randomBytes(24).toString("base64url");
    const id = ulid();
    await db
      .insertInto("drive_access_key")
      .values({
        id,
        workspace_id: auth.workspaceId,
        virtual_storage_id: storageId,
        access_key_id: accessKeyId,
        secret_hash: sha256(secretAccessKey),
        label: body.label?.trim() ?? "",
        created_at: new Date().toISOString(),
      } as never)
      .execute();
    // Secret returned exactly once.
    return { id, accessKeyId, secretAccessKey, label: body.label?.trim() ?? "" };
  });

  app.delete("/storages/:storageId/keys/:id", async (req, reply) => {
    const auth = readForwardedContext(req);
    if (!auth) return unauthorized(reply);
    const { storageId, id } = req.params as { storageId: string; id: string };
    await db
      .deleteFrom("drive_access_key")
      .where("id", "=", id)
      .where("virtual_storage_id", "=", storageId)
      .where("workspace_id", "=", auth.workspaceId)
      .execute();
    return { ok: true };
  });
}

// --- public share downloads ---------------------------------------------------

export function registerShareRoutes(app: FastifyInstance, ctx: Ctx) {
  const { db, dataKey } = ctx;

  app.get("/shares/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const share = await db
      .selectFrom("drive_share_link")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();
    if (!share) return reply.code(404).send({ error: "share not found" });
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
      return reply.code(410).send({ error: "share link expired" });
    }

    const entry = await db
      .selectFrom("drive_entry")
      .selectAll()
      .where("id", "=", share.entry_id)
      .executeTakeFirst();
    if (!entry || entry.deleted_at) return reply.code(404).send({ error: "shared file is gone" });

    try {
      const resolved = await resolveVirtualStorage(db, share.workspace_id, share.virtual_storage_id, dataKey);
      const res = await getFile(db, resolved, entry.path);
      reply.header("content-type", res.contentType ?? "application/octet-stream");
      reply.header("content-disposition", `inline; filename="${entry.path.split("/").pop() ?? "file"}"`);
      return reply.send(res.body);
    } catch (e) {
      return sendStoreError(reply, e);
    }
  });
}
