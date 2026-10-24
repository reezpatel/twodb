import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { getPrivateSetting, setPrivateSetting } from "../lib/server-settings";
import {
  SHARED_CONTENT_LOCK,
  SHARED_CONTENT_STATUSES,
  createSharedContentDatabase,
  insertSharedContentRow,
  isInstagramUrl,
  siteOfUrl,
} from "../lib/shared-content";
import { getNode } from "../lib/notes-nodes";
import { processPendingSharedContent } from "../lib/shared-content-processor";

/** Per-org shared-content settings: which locked database receives shares. */
interface SharedContentTargets {
  /** Fallback database for any shared link. */
  default: string | null;
  /** Instagram links go here when set (falls back to default). */
  instagram: string | null;
}

const targetsKey = (organizationId: string) => `shared_content_targets:${organizationId}`;

async function getTargets(organizationId: string): Promise<SharedContentTargets> {
  const stored = await getPrivateSetting<Partial<SharedContentTargets>>(targetsKey(organizationId));
  return { default: stored?.default ?? null, instagram: stored?.instagram ?? null };
}

async function listSharedContentDatabases(organizationId: string) {
  const rows = await db
    .selectFrom("note_node")
    .select(["id", "parentId", "title", "icon", "deletedAt", "updatedAt"])
    .where("organizationId", "=", organizationId)
    .where("kind", "=", "database")
    .where("schemaLockedBy", "=", SHARED_CONTENT_LOCK)
    .orderBy("createdAt", "asc")
    .execute();
  return rows.map((r) => ({ id: r.id, parentId: r.parentId, title: r.title, icon: r.icon, deletedAt: r.deletedAt, updatedAt: r.updatedAt }));
}

async function requireSharedContentDatabase(organizationId: string, id: string) {
  const node = await getNode(organizationId, id, { includeDeleted: true });
  if (!node || node.kind !== "database" || node.schemaLockedBy !== SHARED_CONTENT_LOCK) return null;
  return node;
}

export const sharedContentRoutes = new Hono()
  /** Locked shared_content databases + configured targets. */
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const [databases, targets] = await Promise.all([listSharedContentDatabases(s.organizationId), getTargets(s.organizationId)]);
    return c.json({ databases, targets, statuses: SHARED_CONTENT_STATUSES });
  })

  /** Create a new locked shared_content database. Root-level by default —
   *  it can be moved under any page afterwards. */
  .post("/databases", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Shared content";

    let parentId: string | null = null;
    if (typeof body?.parentId === "string" && body.parentId) {
      const parent = await getNode(s.organizationId, body.parentId);
      if (!parent || parent.kind === "database") return c.json({ error: "invalid_parent" }, 400);
      parentId = parent.id;
    }

    const row = await createSharedContentDatabase(s.organizationId, title, parentId);
    return c.json({ id: row.id, parentId: row.parentId, title: row.title }, 201);
  })

  /** Configure which database receives shares (default + per-site overrides). */
  .put("/targets", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

    const current = await getTargets(s.organizationId);
    const next: SharedContentTargets = { ...current };
    for (const key of ["default", "instagram"] as const) {
      if (body[key] === undefined) continue;
      const value = body[key];
      if (value === null) {
        next[key] = null;
        continue;
      }
      if (typeof value !== "string") return c.json({ error: `invalid_target:${key}` }, 400);
      const database = await requireSharedContentDatabase(s.organizationId, value);
      if (!database) return c.json({ error: "not_a_shared_content_database", detail: value }, 400);
      next[key] = database.id;
    }
    await setPrivateSetting(targetsKey(s.organizationId), next);
    return c.json({ targets: next });
  })

  /** Share intake: store a shared link/text as a row in a shared_content
   *  database. process=true → status "pending" (a processor picks it up
   *  later); otherwise "saved". */
  .post("/rows", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);

    const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : null;
    const text = typeof body.text === "string" && body.text.trim() ? body.text.trim() : null;
    if (!url && !text) return c.json({ error: "nothing_to_save" }, 400);

    const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim()) : [];
    const medias = Array.isArray(body.medias) ? (body.medias as unknown[]) : [];
    const process = body.process === true;

    // Resolve target database: explicit id → per-site target → default.
    const targets = await getTargets(s.organizationId);
    let databaseId: string | null = typeof body.databaseId === "string" && body.databaseId ? body.databaseId : null;
    if (!databaseId && url) databaseId = isInstagramUrl(url) ? (targets.instagram ?? targets.default) : targets.default;
    if (!databaseId) databaseId = targets.default;
    if (!databaseId) return c.json({ error: "no_shared_content_database" }, 409);

    const database = await requireSharedContentDatabase(s.organizationId, databaseId);
    if (!database) return c.json({ error: "not_a_shared_content_database", detail: databaseId }, 400);

    // Everything that isn't a dedicated property goes into content as markdown.
    const title = (typeof body.title === "string" && body.title.trim()) || (url ? (siteOfUrl(url) ?? url) : null) || "Shared content";
    const contentParts: string[] = [];
    if (text) contentParts.push(text);
    if (url) contentParts.push(`[${title}](${url})`);
    const content = contentParts.join("\n\n") || null;

    const noteId = await insertSharedContentRow(s.organizationId, {
      databaseId: database.id,
      title,
      content,
      url,
      tags,
      medias,
      status: process ? "pending" : "saved",
    });
    // Kick the processor right away — rows we have no handler for stay pending.
    if (process) void processPendingSharedContent();
    return c.json({ noteId, databaseId: database.id, status: process ? "pending" : "saved" }, 201);
  });
