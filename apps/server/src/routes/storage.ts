import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { getStorageDriver } from "../lib/storage/registry";
import { pathSegments } from "../lib/storage/driver";
import { bucketUsedBytes, listChildren, trackFile, trackFolderChain } from "../lib/storage/entries";
import type { StorageBucketTable } from "../plugins/db";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

interface RawMatch {
  bucketId: string;
  rel: string;
}

/** Extracts {bucketId, rel} from /api/storage/buckets/<id>/raw/<rel…>. */
function matchRaw(pathName: string): RawMatch | null {
  const match = pathName.match(/^\/api\/storage\/buckets\/([^/]+)\/raw\/(.+)$/);
  if (!match) return null;
  return { bucketId: match[1], rel: decodeURIComponent(match[2]) };
}

function driverPath(organizationId: string, rel: string) {
  return [organizationId, ...pathSegments(rel)].join("/");
}

async function orgBucket(organizationId: string, bucketId: string): Promise<StorageBucketTable | null> {
  const row = await db.selectFrom("storage_bucket").selectAll().where("id", "=", bucketId).where("organizationId", "=", organizationId).executeTakeFirst();
  return row ?? null;
}

export const storageRoutes = new Hono()
  /** Enabled backends — the pool orgs create buckets on. */
  .get("/backends", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const rows = await db.selectFrom("storage_backend").select(["id", "name", "type"]).where("enabled", "=", true).orderBy("createdAt", "asc").execute();
    return c.json(rows);
  })

  .get("/buckets", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const buckets = await db
      .selectFrom("storage_bucket")
      .innerJoin("storage_backend", "storage_backend.id", "storage_bucket.backendId")
      .select((eb) => [
        "storage_bucket.id",
        "storage_bucket.name",
        "storage_bucket.backendId",
        "storage_bucket.storageLimit",
        eb.ref("storage_backend.name").as("backendName"),
        eb.ref("storage_backend.type").as("backendType"),
      ])
      .where("storage_bucket.organizationId", "=", s.organizationId)
      .orderBy("storage_bucket.createdAt", "asc")
      .execute();

    const usage = await db
      .selectFrom("storage_entry")
      .select(["bucketId", (eb) => eb.fn.sum("size").as("used")])
      .where("organizationId", "=", s.organizationId)
      .where("type", "=", "file")
      .groupBy("bucketId")
      .execute();
    const usedByBucket = new Map(usage.map((u) => [u.bucketId, Number(u.used)]));

    return c.json(buckets.map((b) => ({ ...b, used: usedByBucket.get(b.id) ?? 0 })));
  })

  .post("/buckets", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim().toLowerCase() : "";
    const backendId = typeof body?.backendId === "string" ? body.backendId : "";
    const type = typeof body?.type === "string" && body.type.trim() ? body.type.trim() : "default";
    let storageLimit: number | null = null;
    if (body?.storageLimit !== undefined && body?.storageLimit !== null) {
      if (typeof body.storageLimit !== "number" || !Number.isSafeInteger(body.storageLimit) || body.storageLimit <= 0) {
        return c.json({ error: "invalid_storage_limit" }, 400);
      }
      storageLimit = body.storageLimit;
    }
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) return c.json({ error: "invalid_name" }, 400);
    if (!backendId) return c.json({ error: "invalid_backend" }, 400);

    const backend = await db.selectFrom("storage_backend").select("id").where("id", "=", backendId).where("enabled", "=", true).executeTakeFirst();
    if (!backend) return c.json({ error: "backend_not_found" }, 404);

    const clash = await db.selectFrom("storage_bucket").select("id").where("organizationId", "=", s.organizationId).where("name", "=", name).executeTakeFirst();
    if (clash) return c.json({ error: "name_taken" }, 409);

    const now = new Date();
    const row = await db
      .insertInto("storage_bucket")
      .values({
        id: crypto.randomUUID(),
        organizationId: s.organizationId,
        backendId: backend.id,
        name,
        type,
        isInternal: body?.isInternal === true,
        storageLimit,
        createdAt: now,
        updatedAt: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row, 201);
  })

  .patch("/buckets/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const bucket = await orgBucket(s.organizationId, c.req.param("id"));
    if (!bucket) return c.json({ error: "bucket_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; storageLimit: number | null }> = {};
    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) return c.json({ error: "invalid_name" }, 400);
      const clash = await db
        .selectFrom("storage_bucket")
        .select("id")
        .where("organizationId", "=", s.organizationId)
        .where("name", "=", name)
        .executeTakeFirst();
      if (clash && clash.id !== bucket.id) return c.json({ error: "name_taken" }, 409);
      patch.name = name;
    }
    if (body?.storageLimit !== undefined) {
      if (body.storageLimit === null) {
        patch.storageLimit = null;
      } else if (typeof body.storageLimit === "number" && Number.isSafeInteger(body.storageLimit) && body.storageLimit > 0) {
        patch.storageLimit = body.storageLimit;
      } else {
        return c.json({ error: "invalid_storage_limit" }, 400);
      }
    }
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("storage_bucket")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", bucket.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/buckets/:id", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const row = await db.deleteFrom("storage_bucket").where("id", "=", c.req.param("id")).where("organizationId", "=", s.organizationId).executeTakeFirst();
    if (!row) return c.json({ error: "bucket_not_found" }, 404);
    return c.json({ ok: true });
  })

  .get("/buckets/:id/list", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const folder = (c.req.query("path") ?? "").replace(/^\/+|\/+$/g, "");

    try {
      pathSegments(folder);
      const bucket = await orgBucket(s.organizationId, c.req.param("id"));
      if (!bucket) return c.json({ error: "bucket_not_found" }, 404);
      await getStorageDriver(bucket.backendId);
      const children = await listChildren(s.organizationId, bucket.id, folder);
      return c.json(
        children.map(({ id, path, type, size, mimeType, previewType, updatedAt }) => ({
          id,
          path,
          type,
          size: Number(size),
          mimeType,
          previewType,
          updatedAt,
        })),
      );
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  })

  .get("/buckets/:id/raw/*", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const match = matchRaw(c.req.path);
    if (!match) return c.json({ error: "not_found" }, 404);

    try {
      const segments = pathSegments(match.rel);
      if (!segments.at(-1)?.includes(".")) {
        return c.json({ error: "is_folder" }, 400);
      }
      const bucket = await orgBucket(s.organizationId, match.bucketId);
      if (!bucket) return c.json({ error: "bucket_not_found" }, 404);
      const { driver } = await getStorageDriver(bucket.backendId);
      const file = await driver.get(driverPath(s.organizationId, match.rel));
      return c.body(new Uint8Array(file.body), 200, {
        ...(file.contentType ? { "content-type": file.contentType } : {}),
        "content-disposition": `attachment; filename="${segments.at(-1)}"`,
      });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  })

  .put("/buckets/:id/raw/*", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const match = matchRaw(c.req.path);
    if (!match) return c.json({ error: "not_found" }, 404);

    try {
      const segments = pathSegments(match.rel);
      const data = Buffer.from(await c.req.arrayBuffer());
      if (data.byteLength > MAX_UPLOAD_BYTES) return c.json({ error: "file_too_large" }, 413);

      const bucket = await orgBucket(s.organizationId, match.bucketId);
      if (!bucket) return c.json({ error: "bucket_not_found" }, 404);

      if (bucket.storageLimit !== null) {
        const used = await bucketUsedBytes(bucket.id);
        const replaced = await db
          .selectFrom("storage_entry")
          .select("size")
          .where("bucketId", "=", bucket.id)
          .where("path", "=", segments.join("/"))
          .where("type", "=", "file")
          .executeTakeFirst();
        const next = used - Number(replaced?.size ?? 0) + data.byteLength;
        if (next > Number(bucket.storageLimit)) return c.json({ error: "quota_exceeded" }, 413);
      }

      const { backend, driver } = await getStorageDriver(bucket.backendId);
      await driver.put(driverPath(s.organizationId, match.rel), data, c.req.header("content-type") ?? undefined);
      await trackFile(s.organizationId, bucket.id, segments.join("/"), data.byteLength, c.req.header("content-type") ?? null);
      void backend;
      return c.json({ ok: true, size: data.byteLength });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  })

  .post("/buckets/:id/folder", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);

    const body = await c.req.json().catch(() => null);
    const rel = typeof body?.path === "string" ? body.path.replace(/^\/+|\/+$/g, "") : "";
    if (!rel) return c.json({ error: "invalid_path" }, 400);

    try {
      const segments = pathSegments(rel);
      const bucket = await orgBucket(s.organizationId, c.req.param("id"));
      if (!bucket) return c.json({ error: "bucket_not_found" }, 404);
      const { driver } = await getStorageDriver(bucket.backendId);
      await driver.mkdir?.(driverPath(s.organizationId, rel));
      await trackFolderChain(s.organizationId, bucket.id, segments);
      return c.json({ ok: true }, 201);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  })

  .delete("/buckets/:id/raw/*", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const match = matchRaw(c.req.path);
    if (!match) return c.json({ error: "not_found" }, 404);

    try {
      const segments = pathSegments(match.rel);
      const rel = segments.join("/");
      const bucket = await orgBucket(s.organizationId, match.bucketId);
      if (!bucket) return c.json({ error: "bucket_not_found" }, 404);
      const { driver } = await getStorageDriver(bucket.backendId);

      const entry = await db.selectFrom("storage_entry").select(["id", "type"]).where("bucketId", "=", bucket.id).where("path", "=", rel).executeTakeFirst();

      if (entry?.type === "folder") {
        await driver.delPrefix(driverPath(s.organizationId, rel) + "/");
        await db
          .deleteFrom("storage_entry")
          .where("bucketId", "=", bucket.id)
          .where((eb) => eb("path", "=", rel).or("path", "like", `${rel}/%`))
          .execute();
      } else {
        await driver.del(driverPath(s.organizationId, rel));
        if (entry) {
          await db.deleteFrom("storage_entry").where("id", "=", entry.id).execute();
        }
      }
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });
