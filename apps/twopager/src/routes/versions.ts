import { z } from "zod";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { activate, createDraft, finalize, ingest, loadDraft, loadSite, loadVersion, removeFile, setConfig, versionView } from "../lib/model.js";
import { badRequest, conflict, notFound, tooLarge } from "../lib/http.js";
import { extractZip, type Entry } from "../engine/zip.js";
import { guessContentType, isTextType, normalizeFilePath, safeHeaderValue } from "../engine/paths.js";
import { siteConfigSchema } from "../engine/siteconfig.js";
import { anyList, anyObject, boolish, ok, siteId, versionId } from "./schemas.js";
import { limits } from "../lib/model.js";

const fileInput = z
  .object({
    path: z.string().min(1).max(512).describe("File path inside the site, e.g. `index.html` or `blog/post-1/index.html`"),
    content: z.string().optional().describe("UTF-8 text content (HTML, CSS, JS, …)"),
    contentBase64: z.string().optional().describe("Base64 content for binary files (images, fonts, …)"),
    contentType: z.string().max(200).optional().describe("Overrides the type guessed from the extension"),
  })
  .refine((f) => (f.content === undefined) !== (f.contentBase64 === undefined), "provide exactly one of content / contentBase64");

function toEntries(files: z.infer<typeof fileInput>[]): Entry[] {
  return files.map((f) => {
    if (f.contentType && !safeHeaderValue(f.contentType)) throw badRequest(`invalid contentType for ${f.path}`);
    return { path: f.path, data: f.content !== undefined ? Buffer.from(f.content, "utf8") : Buffer.from(f.contentBase64!, "base64"), contentType: f.contentType };
  });
}

async function withFiles(ctx: Ctx, siteIdV: string, row: any, activeId: string | null) {
  const files = (await ctx.db.selectFrom("site_file").select(["path", "size", "content_type", "sha256"]).where("version_id", "=", row.id).orderBy("path").execute()) as any[];
  return {
    ...versionView(row, activeId),
    files: files.map((f) => ({ path: f.path, size: Number(f.size), contentType: f.content_type, sha256: f.sha256 })),
  };
}

export const versionRoutes: RouteDef[] = [
  route({
    name: "listVersions", method: "GET", path: "/sites/:siteId/versions",
    description: "All versions of a site, newest first. `active` marks the live one. Roll back by activating an older version.",
    request: z.object({ siteId }), response: anyList,
    handler: async (ctx, { siteId: id }) => {
      const site = await loadSite(ctx, id);
      const rows = await ctx.db.selectFrom("site_version").selectAll().where("site_id", "=", id).orderBy("number", "desc").execute();
      return rows.map((r) => versionView(r, site.active_version_id));
    },
  }),
  route({
    name: "createVersion", method: "POST", path: "/sites/:siteId/versions",
    description:
      "Start a new DRAFT version. Seed it from an existing version with `fromVersionId` (or `fromActive: true`) to edit/add pages on top of the live site; " +
      "omit both for an empty one. Then PUT files, optionally set the config, and finalize (+activate).",
    request: z.object({ siteId, fromVersionId: z.string().optional(), fromActive: boolish.optional(), message: z.string().max(300).optional() }), response: anyObject,
    handler: async (ctx, { siteId: id, fromVersionId, fromActive, message }) => {
      const site = await loadSite(ctx, id);
      let from = fromVersionId ?? null;
      if (!from && fromActive) {
        if (!site.active_version_id) throw badRequest("the site has no active version yet");
        from = site.active_version_id;
      }
      return versionView(await createDraft(ctx, id, { fromVersionId: from, message }), site.active_version_id);
    },
  }),
  route({
    name: "getVersion", method: "GET", path: "/sites/:siteId/versions/:versionId",
    description: "One version with its file list (path, size, contentType, sha256) and config.",
    request: z.object({ siteId, versionId }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid }) => {
      const site = await loadSite(ctx, id);
      return withFiles(ctx, id, await loadVersion(ctx, id, vid), site.active_version_id);
    },
  }),
  route({
    name: "putFiles", method: "PUT", path: "/sites/:siteId/versions/:versionId/files",
    description:
      "Add or replace pages/assets in a DRAFT version (up to 500 per call). Text via `content`, binary via `contentBase64`. " +
      "A file named `twopager.json` sets the version config instead of being served.",
    request: z.object({ siteId, versionId, files: z.array(fileInput).min(1).max(500) }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid, files }) => {
      const site = await loadSite(ctx, id);
      await loadDraft(ctx, id, vid);
      await ingest(ctx, id, vid, toEntries(files));
      return { ...versionView(await loadVersion(ctx, id, vid), site.active_version_id), written: files.length };
    },
  }),
  route({
    name: "deleteFile", method: "DELETE", path: "/sites/:siteId/versions/:versionId/files",
    description: "Remove one file (by `path` query parameter) from a DRAFT version.",
    request: z.object({ siteId, versionId, path: z.string().min(1) }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid, path }) => {
      const site = await loadSite(ctx, id);
      await loadDraft(ctx, id, vid);
      await removeFile(ctx, id, vid, path);
      return versionView(await loadVersion(ctx, id, vid), site.active_version_id);
    },
  }),
  route({
    name: "getFile", method: "GET", path: "/sites/:siteId/versions/:versionId/file",
    description: "Read one file of any version: `{path, contentType, size, sha256, encoding: utf8|base64, content}`.",
    request: z.object({ siteId, versionId, path: z.string().min(1) }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid, path }) => {
      await loadSite(ctx, id);
      await loadVersion(ctx, id, vid);
      const p = normalizeFilePath(path);
      const f = (await ctx.db.selectFrom("site_file").selectAll().where("version_id", "=", vid).where("path", "=", p).executeTakeFirst()) as any;
      if (!f) throw notFound("file_not_found");
      if (Number(f.size) > 5 * 1048576) throw tooLarge("file is too large to read through the API");
      const data = await ctx.blobs.read(id, f.sha256);
      const text = isTextType(f.content_type);
      return { path: p, contentType: f.content_type, size: Number(f.size), sha256: f.sha256, encoding: text ? "utf8" : "base64", content: data.toString(text ? "utf8" : "base64") };
    },
  }),
  route({
    name: "setVersionConfig", method: "PUT", path: "/sites/:siteId/versions/:versionId/config",
    description:
      "Replace the serving config of a DRAFT version. Fields: `spa` (catch-all rewrite to /index.html), `cleanUrls`, `trailingSlash`, " +
      "`rewrites:[{source,destination}]`, `redirects:[{source,destination,type}]`, `headers:[{source,headers:[{key,value}]}]`, `notFoundPage`. " +
      "Sources are globs (`**`, `*`, `?`, `{a,b}`, `:name`). Order: redirects → static file → rewrites → 404.",
    request: z.object({ siteId, versionId, config: siteConfigSchema }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid, config }) => {
      const site = await loadSite(ctx, id);
      await loadDraft(ctx, id, vid);
      await setConfig(ctx, vid, config);
      return versionView(await loadVersion(ctx, id, vid), site.active_version_id);
    },
  }),
  route({
    name: "finalizeVersion", method: "POST", path: "/sites/:siteId/versions/:versionId/finalize",
    description: "Freeze a draft (it becomes immutable). With `activate: true` it goes live immediately.",
    request: z.object({ siteId, versionId, activate: boolish.optional() }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid, activate: go }) => {
      await loadSite(ctx, id);
      await finalize(ctx, id, vid);
      if (go) await activate(ctx, id, vid);
      const site = await loadSite(ctx, id);
      return versionView(await loadVersion(ctx, id, vid), site.active_version_id);
    },
  }),
  route({
    name: "activateVersion", method: "POST", path: "/sites/:siteId/activate",
    description: "Make a finalized version the live one (also how you roll back). Takes effect within seconds.",
    request: z.object({ siteId, versionId }), response: anyObject,
    handler: async (ctx, { siteId: id, versionId: vid }) => {
      await loadSite(ctx, id);
      await activate(ctx, id, vid);
      return versionView(await loadVersion(ctx, id, vid), vid);
    },
  }),
  route({
    name: "deleteVersion", method: "DELETE", path: "/sites/:siteId/versions/:versionId",
    description: "Delete a version that is not active. Blobs no other version uses are removed from S3.",
    request: z.object({ siteId, versionId }), response: ok,
    handler: async (ctx, { siteId: id, versionId: vid }) => {
      const site = await loadSite(ctx, id);
      await loadVersion(ctx, id, vid);
      if (site.active_version_id === vid) throw conflict("version_active", "the active version cannot be deleted — activate another one first");
      const shas = ((await ctx.db.selectFrom("site_file").select("sha256").distinct().where("version_id", "=", vid).execute()) as any[]).map((r) => r.sha256 as string);
      await ctx.db.deleteFrom("site_version").where("id", "=", vid).execute(); // cascades files
      ctx.resolver.forgetVersion(vid);
      await ctx.blobs.gc(id, shas);
      return { ok: true };
    },
  }),
  route({
    name: "uploadZip", method: "POST", path: "/sites/:siteId/versions/zip",
    description:
      "Publish a whole site from a zip in one call. Send the zip as the RAW request body (`Content-Type: application/zip`, query: message, activate) " +
      "or as JSON `{zipBase64, message, activate}`. The zip is a full snapshot: it becomes a new finalized version (a single wrapping folder is stripped, " +
      "`twopager.json` at the root is the config) and, unless `activate: false`, goes live.",
    request: z.object({ siteId, zipBase64: z.string().optional(), message: z.string().max(300).optional(), activate: boolish.optional() }), response: anyObject,
    handler: async (ctx, { siteId: id, zipBase64, message, activate: go }, raw) => {
      await loadSite(ctx, id);
      const buf = raw ?? (zipBase64 ? Buffer.from(zipBase64, "base64") : null);
      if (!buf?.length) throw badRequest("send the zip as the raw request body (application/zip) or as JSON {zipBase64}");
      const max = ctx.config.MAX_ZIP_MB * 1048576;
      if (buf.length > max) throw tooLarge(`zip exceeds the ${ctx.config.MAX_ZIP_MB} MB upload limit`);
      const entries = extractZip(buf, limits(ctx));
      const draft = await createDraft(ctx, id, { message: message ?? "zip upload" });
      try {
        await ingest(ctx, id, draft.id, entries, { replace: true });
        await finalize(ctx, id, draft.id);
      } catch (e) {
        await ctx.db.deleteFrom("site_version").where("id", "=", draft.id).execute().catch(() => {});
        throw e;
      }
      if (go ?? true) await activate(ctx, id, draft.id);
      const site = await loadSite(ctx, id);
      return versionView(await loadVersion(ctx, id, draft.id), site.active_version_id);
    },
  }),
  route({
    name: "publishPage", method: "POST", path: "/sites/:siteId/pages",
    description:
      "One-shot: add or replace pages on top of the live site. Clones the active version (or starts empty), writes `pages`, finalizes and — unless `activate: false` — activates the result. " +
      "Use this for small edits by an agent; use the draft endpoints or a zip for bigger changes.",
    request: z.object({ siteId, pages: z.array(fileInput).min(1).max(500), message: z.string().max(300).optional(), activate: boolish.optional() }), response: anyObject,
    handler: async (ctx, { siteId: id, pages, message, activate: go }) => {
      const site = await loadSite(ctx, id);
      const draft = await createDraft(ctx, id, { fromVersionId: site.active_version_id ?? null, message: message ?? "publish page" });
      try {
        await ingest(ctx, id, draft.id, toEntries(pages));
        await finalize(ctx, id, draft.id);
      } catch (e) {
        await ctx.db.deleteFrom("site_version").where("id", "=", draft.id).execute().catch(() => {});
        throw e;
      }
      if (go ?? true) await activate(ctx, id, draft.id);
      const fresh = await loadSite(ctx, id);
      return versionView(await loadVersion(ctx, id, draft.id), fresh.active_version_id);
    },
  }),
];
