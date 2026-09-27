import { Hono } from "hono";
import { db, auth } from "../auth";
import { getStorageDriverAnyState } from "../lib/storage/registry";
import { pathSegments } from "../lib/storage/driver";
import { trackFile, trackFolderChain } from "../lib/storage/entries";

// Server-admin only: storage backends are configured once per server; files
// inside them are org-scoped (each org lives under `<orgId>/…`).

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

export const storageAdminRoutes = new Hono()
  .use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session || session.user.role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  })

  .get("/", async (c) => {
    const rows = await db.selectFrom("storage_backend").selectAll().orderBy("createdAt", "asc").execute();
    return c.json(rows);
  })

  .post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim().toLowerCase() : "";
    const type = body?.type;
    const config = (body?.config ?? {}) as Record<string, unknown>;

    if (!NAME_RE.test(name)) return c.json({ error: "invalid_name" }, 400);
    if (type !== "object" && type !== "block") return c.json({ error: "invalid_type" }, 400);

    if (type === "object") {
      for (const key of ["endpoint", "bucket", "accessKeyId", "secretAccessKey"]) {
        if (typeof config[key] !== "string" || !(config[key] as string).trim()) {
          return c.json({ error: `missing_config:${key}` }, 400);
        }
      }
    } else if (typeof config.rootPath !== "string" || !config.rootPath.trim().startsWith("/")) {
      return c.json({ error: "invalid_root_path" }, 400);
    }

    const existing = await db.selectFrom("storage_backend").select("id").where("name", "=", name).executeTakeFirst();
    if (existing) return c.json({ error: "name_taken" }, 409);

    const now = new Date();
    const row = await db
      .insertInto("storage_backend")
      .values({ id: crypto.randomUUID(), name, type, config, enabled: true, createdAt: now, updatedAt: now })
      .returningAll()
      .executeTakeFirstOrThrow();

    let warning: string | null = null;
    try {
      const { driver } = await getStorageDriverAnyState(row.id);
      await driver.test();
    } catch (e) {
      warning = `backend saved, but connection test failed: ${(e as Error).message}`;
    }
    return c.json({ ...row, warning }, 201);
  })

  .patch("/:id", async (c) => {
    const backend = await db.selectFrom("storage_backend").select("id").where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!backend) return c.json({ error: "backend_not_found" }, 404);

    const body = await c.req.json().catch(() => null);
    const patch: Partial<{ name: string; config: Record<string, unknown>; enabled: boolean }> = {};

    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
      if (!NAME_RE.test(name)) return c.json({ error: "invalid_name" }, 400);
      const clash = await db.selectFrom("storage_backend").select("id").where("name", "=", name).executeTakeFirst();
      if (clash && clash.id !== backend.id) return c.json({ error: "name_taken" }, 409);
      patch.name = name;
    }
    if (body?.config !== undefined) patch.config = body.config as Record<string, unknown>;
    if (body?.enabled !== undefined) patch.enabled = body.enabled === true;
    if (Object.keys(patch).length === 0) return c.json({ error: "empty_update" }, 400);

    const row = await db
      .updateTable("storage_backend")
      .set({ ...patch, updatedAt: new Date() })
      .where("id", "=", backend.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return c.json(row);
  })

  .delete("/:id", async (c) => {
    const backend = await db.deleteFrom("storage_backend").where("id", "=", c.req.param("id")).returning("id").executeTakeFirst();
    if (!backend) return c.json({ error: "backend_not_found" }, 404);
    return c.json({ ok: true });
  })

  .post("/:id/test", async (c) => {
    try {
      const { driver } = await getStorageDriverAnyState(c.req.param("id"));
      await driver.test();
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message }, 200);
    }
  })

  .post("/:id/sync", async (c) => {
    const { backend, driver } = await getStorageDriverAnyState(c.req.param("id"));
    const objects = await driver.list("");
    const orgIds = new Set((await db.selectFrom("organization").select("id").execute()).map((o) => o.id));

    /** Synced objects land in each org's "default" bucket on this backend. */
    const bucketCache = new Map<string, string>();
    const bucketFor = async (orgId: string): Promise<string> => {
      const cached = bucketCache.get(orgId);
      if (cached) return cached;
      const existing = await db.selectFrom("storage_bucket").select("id").where("organizationId", "=", orgId).where("name", "=", "default").executeTakeFirst();
      const bucketId =
        existing?.id ??
        (
          await db
            .insertInto("storage_bucket")
            .values({
              id: crypto.randomUUID(),
              organizationId: orgId,
              backendId: backend.id,
              name: "default",
              type: "default",
              isInternal: false,
              storageLimit: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning("id")
            .executeTakeFirstOrThrow()
        ).id;
      bucketCache.set(orgId, bucketId);
      return bucketId;
    };

    let files = 0;
    const folders = new Set<string>();
    for (const obj of objects) {
      const segments = pathSegments(obj.path);
      const [orgId, ...rest] = segments;
      if (!orgIds.has(orgId) || rest.length === 0) continue;
      const rel = rest.join("/");
      await trackFile(orgId, await bucketFor(orgId), rel, obj.size, null);
      files += 1;
      for (let i = 1; i < rest.length; i++) folders.add(`${orgId}:${rest.slice(0, i).join("/")}`);
    }
    for (const key of folders) {
      const [orgId, folder] = key.split(":");
      await trackFolderChain(orgId, await bucketFor(orgId), pathSegments(folder));
    }
    return c.json({ ok: true, files, folders: folders.size });
  });
