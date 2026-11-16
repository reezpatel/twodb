import { ulid } from "ulid";
import { sql } from "@twodb/core-data/db";
import type { Ctx } from "./route.js";
import { assertSpaceAccess } from "./route.js";
import { HttpError, badRequest, conflict, notFound, tooLarge } from "./http.js";
import { sha256 } from "./blobs.js";
import { CONFIG_FILE, guessContentType, normalizeFilePath } from "../engine/paths.js";
import { parseSiteConfig, type SiteConfig } from "../engine/siteconfig.js";
import type { Entry } from "../engine/zip.js";

export const limits = (ctx: Ctx) => ({
  maxFiles: ctx.config.MAX_FILES,
  maxFileBytes: ctx.config.MAX_FILE_MB * 1048576,
  /** Expanded size of one version. */
  maxTotalBytes: ctx.config.MAX_ZIP_MB * 5 * 1048576,
});

// ── row mappers ────────────────────────────────────────────────────────────
export function siteHosts(ctx: Ctx, slug: string, domains: string[]): string[] {
  const builtin = ctx.config.SITES_DOMAIN ? [`${slug}.${ctx.config.SITES_DOMAIN.replace(/^\.+/, "").toLowerCase()}`] : [];
  return [...builtin, ...domains];
}

export async function siteView(ctx: Ctx, row: any) {
  const domains = ((await ctx.db.selectFrom("site_domain").select("host").where("site_id", "=", row.id).orderBy("created_at").execute()) as any[]).map((d) => d.host as string);
  let activeVersionNumber: number | null = null;
  if (row.active_version_id) {
    const v = (await ctx.db.selectFrom("site_version").select("number").where("id", "=", row.active_version_id).executeTakeFirst()) as any;
    activeVersionNumber = v ? Number(v.number) : null;
  }
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    slug: row.slug,
    activeVersionId: row.active_version_id ?? null,
    activeVersionNumber,
    domains,
    hosts: siteHosts(ctx, row.slug, domains),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const versionView = (row: any, activeId?: string | null) => ({
  id: row.id,
  siteId: row.site_id,
  number: Number(row.number),
  status: row.status as "draft" | "final",
  message: row.message ?? null,
  config: row.config ?? {},
  fileCount: Number(row.file_count),
  totalBytes: Number(row.total_bytes),
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  finalizedAt: row.finalized_at ?? null,
  active: activeId !== undefined ? row.id === activeId : undefined,
});

// ── loaders (workspace + space scoped) ─────────────────────────────────────
export async function loadSite(ctx: Ctx, siteId: string) {
  const row = (await ctx.db.selectFrom("site").selectAll().where("id", "=", siteId).where("workspace_id", "=", ctx.workspaceId).executeTakeFirst()) as any;
  if (!row) throw notFound("site_not_found");
  assertSpaceAccess(ctx, row.space_id);
  return row;
}

export async function loadVersion(ctx: Ctx, siteId: string, versionId: string) {
  const row = (await ctx.db.selectFrom("site_version").selectAll().where("id", "=", versionId).where("site_id", "=", siteId).where("workspace_id", "=", ctx.workspaceId).executeTakeFirst()) as any;
  if (!row) throw notFound("version_not_found");
  return row;
}

export async function loadDraft(ctx: Ctx, siteId: string, versionId: string) {
  const v = await loadVersion(ctx, siteId, versionId);
  if (v.status !== "draft") throw conflict("version_finalized", "this version is finalized and immutable — create a new version (optionally from this one)");
  return v;
}

// ── versions ───────────────────────────────────────────────────────────────
/** New draft version; optionally seeded with the files + config of an existing one (cheap: blobs are shared). */
export async function createDraft(ctx: Ctx, siteId: string, opts: { fromVersionId?: string | null; message?: string | null }) {
  let from: any = null;
  if (opts.fromVersionId) from = await loadVersion(ctx, siteId, opts.fromVersionId);
  const id = ulid();
  await ctx.db.transaction().execute(async (trx) => {
    await trx.selectFrom("site").select("id").where("id", "=", siteId).forUpdate().execute(); // serialize numbering per site
    const max = (await trx.selectFrom("site_version").select(sql<number>`coalesce(max(number), 0)`.as("n")).where("site_id", "=", siteId).executeTakeFirst()) as any;
    await trx
      .insertInto("site_version")
      .values({
        id,
        site_id: siteId,
        workspace_id: ctx.workspaceId,
        number: Number(max?.n ?? 0) + 1,
        status: "draft",
        message: opts.message ?? null,
        config: JSON.stringify(from?.config ?? {}),
        file_count: from?.file_count ?? 0,
        total_bytes: from?.total_bytes ?? 0,
        created_by: ctx.userId,
      })
      .execute();
    if (from) {
      await sql`insert into site_file (version_id, site_id, path, sha256, size, content_type)
                select ${id}, site_id, path, sha256, size, content_type from site_file where version_id = ${from.id}`.execute(trx);
    }
  });
  return loadVersion(ctx, siteId, id);
}

async function recount(db: Ctx["db"], versionId: string) {
  await sql`update site_version set
              file_count = (select count(*) from site_file where version_id = ${versionId}),
              total_bytes = (select coalesce(sum(size), 0) from site_file where version_id = ${versionId})
            where id = ${versionId}`.execute(db);
}

export interface IngestOptions {
  /** Drop every existing file first (zip = full snapshot). */
  replace?: boolean;
}

/** Writes entries into a draft: uploads new blobs, upserts file rows, applies `twopager.json` as the config. */
export async function ingest(ctx: Ctx, siteId: string, versionId: string, input: Entry[], opts: IngestOptions = {}) {
  const lim = limits(ctx);
  let config: SiteConfig | null = null;
  const entries: Entry[] = [];
  for (const e of input) {
    const p = normalizeFilePath(e.path);
    if (p === CONFIG_FILE) {
      try {
        config = parseSiteConfig(JSON.parse(e.data.toString("utf8")));
      } catch (err) {
        throw badRequest(`${CONFIG_FILE} is invalid: ${err instanceof Error ? err.message.slice(0, 400) : "parse error"}`);
      }
      continue;
    }
    if (e.data.length > lim.maxFileBytes) throw tooLarge(`"${p}" exceeds the ${ctx.config.MAX_FILE_MB} MB file limit`);
    entries.push({ path: p, data: e.data, contentType: e.contentType });
  }
  const dup = new Set<string>();
  for (const e of entries) {
    if (dup.has(e.path)) throw badRequest(`duplicate path: ${e.path}`);
    dup.add(e.path);
  }

  const blobs = new Map<string, { data: Buffer; contentType: string }>();
  const rows = entries.map((e) => {
    const sha = sha256(e.data);
    const contentType = e.contentType ?? guessContentType(e.path);
    if (!blobs.has(sha)) blobs.set(sha, { data: e.data, contentType });
    return { version_id: versionId, site_id: siteId, path: e.path, sha256: sha, size: e.data.length, content_type: contentType };
  });
  await ctx.blobs.putAll(siteId, blobs);

  const removed: string[] = [];
  await ctx.db.transaction().execute(async (trx) => {
    const replaced = opts.replace ? "all" : rows.map((r) => r.path);
    const q = trx.selectFrom("site_file").select("sha256").where("version_id", "=", versionId);
    const old = (await (replaced === "all" ? q : q.where("path", "in", replaced.length ? replaced : [""])).execute()) as any[];
    removed.push(...old.map((o) => o.sha256));
    if (replaced === "all") await trx.deleteFrom("site_file").where("version_id", "=", versionId).execute();
    for (let i = 0; i < rows.length; i += 500) {
      await trx
        .insertInto("site_file")
        .values(rows.slice(i, i + 500))
        .onConflict((oc) => oc.columns(["version_id", "path"]).doUpdateSet((eb) => ({ sha256: eb.ref("excluded.sha256"), size: eb.ref("excluded.size"), content_type: eb.ref("excluded.content_type") })))
        .execute();
    }
    if (config) await trx.updateTable("site_version").set({ config: JSON.stringify(config) }).where("id", "=", versionId).execute();
    await recount(trx, versionId);
    const t = (await trx.selectFrom("site_version").select(["file_count", "total_bytes"]).where("id", "=", versionId).executeTakeFirst()) as any;
    if (Number(t.file_count) > lim.maxFiles) throw tooLarge(`a version may hold at most ${lim.maxFiles} files`);
    if (Number(t.total_bytes) > lim.maxTotalBytes) throw tooLarge(`a version may hold at most ${Math.floor(lim.maxTotalBytes / 1048576)} MB`);
  });
  if (removed.length) await ctx.blobs.gc(siteId, removed);
  ctx.resolver.forgetVersion(versionId);
}

export async function removeFile(ctx: Ctx, siteId: string, versionId: string, filePath: string) {
  const p = normalizeFilePath(filePath);
  const row = (await ctx.db.selectFrom("site_file").select("sha256").where("version_id", "=", versionId).where("path", "=", p).executeTakeFirst()) as any;
  if (!row) throw notFound("file_not_found");
  await ctx.db.deleteFrom("site_file").where("version_id", "=", versionId).where("path", "=", p).execute();
  await recount(ctx.db, versionId);
  await ctx.blobs.gc(siteId, [row.sha256]);
  ctx.resolver.forgetVersion(versionId);
}

export async function setConfig(ctx: Ctx, versionId: string, config: SiteConfig) {
  await ctx.db.updateTable("site_version").set({ config: JSON.stringify(config) }).where("id", "=", versionId).execute();
  ctx.resolver.forgetVersion(versionId);
}

export async function finalize(ctx: Ctx, siteId: string, versionId: string) {
  const v = await loadVersion(ctx, siteId, versionId);
  if (v.status === "final") return v;
  if (Number(v.file_count) === 0) throw badRequest("cannot finalize an empty version");
  await ctx.db.updateTable("site_version").set({ status: "final", finalized_at: sql`now()` }).where("id", "=", versionId).execute();
  return loadVersion(ctx, siteId, versionId);
}

export async function activate(ctx: Ctx, siteId: string, versionId: string) {
  const v = await loadVersion(ctx, siteId, versionId);
  if (v.status !== "final") throw conflict("version_not_final", "only finalized versions can be activated");
  await ctx.db.updateTable("site").set({ active_version_id: versionId, updated_at: sql`now()` }).where("id", "=", siteId).execute();
  ctx.resolver.invalidateSite(siteId);
}

export { HttpError };
