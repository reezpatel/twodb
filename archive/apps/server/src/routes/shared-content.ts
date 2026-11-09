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

/** Per-org shared-content settings: which locked database receives shares,
 *  plus per-org integration config (read by the processor from the same
 *  settings blob). */
interface SharedContentTargets {
  /** Fallback database for any shared link. */
  default: string | null;
  /** Instagram links go here when set (falls back to default). */
  instagram: string | null;
  /** Instagram `sessionid` cookie for gated content — never echoed back in
   *  full by the API. */
  instagramSessionId?: string;
}

const targetsKey = (organizationId: string) => `shared_content_targets:${organizationId}`;

async function getSettings(organizationId: string): Promise<SharedContentTargets> {
  const stored = await getPrivateSetting<Partial<SharedContentTargets>>(targetsKey(organizationId));
  return { default: stored?.default ?? null, instagram: stored?.instagram ?? null, instagramSessionId: stored?.instagramSessionId };
}

/** Targets only (drops the secret). */
async function getTargets(organizationId: string): Promise<Pick<SharedContentTargets, "default" | "instagram">> {
  const { default: d, instagram } = await getSettings(organizationId);
  return { default: d, instagram };
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

/** Show just enough to confirm which cookie is configured. */
function maskSessionId(sessionId: string): string {
  let decoded = sessionId;
  try {
    decoded = decodeURIComponent(sessionId);
  } catch {
    // keep raw
  }
  const id = decoded.split(":")[0];
  return id ? `${id}:…` : "…";
}

export const sharedContentRoutes = new Hono()
  /** Locked shared_content databases + configured targets + integration config. */
  .get("/", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const [databases, settings] = await Promise.all([listSharedContentDatabases(s.organizationId), getSettings(s.organizationId)]);
    const sessionId = (settings.instagramSessionId ?? "").trim();
    return c.json({
      databases,
      targets: { default: settings.default, instagram: settings.instagram },
      statuses: SHARED_CONTENT_STATUSES,
      instagram: { sessionIdConfigured: sessionId !== "", sessionIdMasked: sessionId ? maskSessionId(sessionId) : null },
    });
  })

  /** Instagram session cookie (`sessionid`) for fetching gated content, per
   *  org. Stored in the org's settings blob; never echoed back in full.
   *  Empty string clears it. */
  .put("/instagram", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.body(null, 401);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "invalid_body" }, 400);
    const raw = body.sessionId;
    if (raw !== null && typeof raw !== "string") return c.json({ error: "invalid_session_id" }, 400);
    const value = typeof raw === "string" ? raw.trim() : "";
    const current = await getSettings(s.organizationId);
    await setPrivateSetting(targetsKey(s.organizationId), { ...current, instagramSessionId: value });
    return c.json({ sessionIdConfigured: value !== "", sessionIdMasked: value ? maskSessionId(value) : null });
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

    const current = await getSettings(s.organizationId);
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
    // The medias prop is a `media` column: media ids only (strings). Incoming
    // file descriptors (PWA share target sends {name,type,size}) are noted in
    // the content instead of being stored in the column.
    const rawMedias = Array.isArray(body.medias) ? (body.medias as unknown[]) : [];
    const medias = rawMedias.filter((m): m is string => typeof m === "string" && m.trim() !== "");
    const fileNotes = rawMedias
      .map((m) => (typeof m === "object" && m !== null && typeof (m as { name?: unknown }).name === "string" ? (m as { name: string; type?: unknown }).name : null))
      .filter((n): n is string => !!n);
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
    if (fileNotes.length) contentParts.push(fileNotes.map((n) => `- 📎 ${n}`).join("\n"));
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
