import { z } from "zod";
import { ulid } from "ulid";
import { sql } from "@twodb/core-data/db";
import { route, assertSpaceAccess, type RouteDef } from "../lib/route.js";
import { loadSite, siteView } from "../lib/model.js";
import { conflict, notFound, badRequest } from "../lib/http.js";
import { anyList, anyObject, boolish, hostname, ok, siteId, slug, spaceId } from "./schemas.js";
import { normalizeHost } from "../engine/resolver.js";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 38) || "site";

function assertDomainAllowed(ctx: { config: { ADMIN_HOSTS: string; SITES_DOMAIN?: string } }, host: string) {
  const admin = ctx.config.ADMIN_HOSTS.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (admin.includes(host)) throw badRequest("that host is reserved for the TwoPager admin UI");
  if (host === "localhost" || host.endsWith(".localhost")) throw badRequest("localhost cannot be used as a site domain");
}

export const siteRoutes: RouteDef[] = [
  route({
    name: "listSites", method: "GET", path: "/sites",
    description: "Sites of a space. Each site has hosts (custom domains + built-in `<slug>.<SITES_DOMAIN>` when configured) and an active version.",
    request: z.object({ spaceId }), response: anyList,
    handler: async (ctx, { spaceId: sid }) => {
      assertSpaceAccess(ctx, sid);
      const rows = await ctx.db.selectFrom("site").selectAll().where("workspace_id", "=", ctx.workspaceId).where("space_id", "=", sid).orderBy("created_at", "desc").execute();
      return Promise.all(rows.map((r) => siteView(ctx, r)));
    },
  }),
  route({
    name: "createSite", method: "POST", path: "/sites",
    description: "Create a site in a space (`slug` is the globally unique built-in subdomain; derived from `name` when omitted). Optionally attach custom `domains` right away.",
    request: z.object({ spaceId, name: z.string().min(1).max(80), slug: slug.optional(), domains: z.array(hostname).max(20).optional() }), response: anyObject,
    handler: async (ctx, b) => {
      assertSpaceAccess(ctx, b.spaceId);
      let wanted = b.slug ?? slugify(b.name);
      if (!b.slug) {
        // auto-slug: make it unique by suffixing instead of failing
        const taken = await ctx.db.selectFrom("site").select("id").where("slug", "=", wanted).executeTakeFirst();
        if (taken) wanted = `${wanted.slice(0, 31)}-${ulid().slice(-6).toLowerCase()}`;
      }
      const id = ulid();
      for (const d of b.domains ?? []) assertDomainAllowed(ctx, d);
      try {
        await ctx.db.transaction().execute(async (trx) => {
          await trx.insertInto("site").values({ id, workspace_id: ctx.workspaceId, space_id: b.spaceId, name: b.name, slug: wanted, created_by: ctx.userId }).execute();
          for (const host of b.domains ?? []) await trx.insertInto("site_domain").values({ host, site_id: id, workspace_id: ctx.workspaceId }).execute();
        });
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw conflict("conflict", "that slug or one of the domains is already taken");
        throw e;
      }
      ctx.resolver.invalidateSite(id);
      return siteView(ctx, await loadSite(ctx, id));
    },
  }),
  route({
    name: "getSite", method: "GET", path: "/sites/:siteId",
    description: "One site with its hosts and active version.",
    request: z.object({ siteId }), response: anyObject,
    handler: async (ctx, { siteId: id }) => siteView(ctx, await loadSite(ctx, id)),
  }),
  route({
    name: "renameSite", method: "PATCH", path: "/sites/:siteId",
    description: "Rename a site (the slug and domains are unchanged).",
    request: z.object({ siteId, name: z.string().min(1).max(80) }), response: anyObject,
    handler: async (ctx, { siteId: id, name }) => {
      await loadSite(ctx, id);
      await ctx.db.updateTable("site").set({ name, updated_at: sql`now()` }).where("id", "=", id).execute();
      return siteView(ctx, await loadSite(ctx, id));
    },
  }),
  route({
    name: "deleteSite", method: "DELETE", path: "/sites/:siteId",
    description: "Delete a site with all its versions, files (also removed from S3) and domains. Takes the site offline immediately.",
    request: z.object({ siteId, confirm: boolish.optional() }), response: ok,
    handler: async (ctx, { siteId: id }) => {
      await loadSite(ctx, id);
      await ctx.db.deleteFrom("site").where("id", "=", id).execute(); // cascades domains, versions, files
      ctx.resolver.invalidateSite(id);
      await ctx.blobs.deleteSite(id);
      return { ok: true };
    },
  }),
  route({
    name: "addDomain", method: "POST", path: "/sites/:siteId/domains",
    description:
      "Attach a custom domain. Point its DNS (CNAME/A) at the TwoDB gateway and make sure TLS for it terminates in front of the gateway; " +
      "requests whose Host matches are served from the site's active version. A domain can belong to one site only.",
    request: z.object({ siteId, host: hostname }), response: anyObject,
    handler: async (ctx, { siteId: id, host }) => {
      const site = await loadSite(ctx, id);
      assertDomainAllowed(ctx, host);
      const count = (await ctx.db.selectFrom("site_domain").select(sql<number>`count(*)`.as("n")).where("site_id", "=", id).executeTakeFirst()) as any;
      if (Number(count.n) >= 20) throw badRequest("a site may have at most 20 domains");
      try {
        await ctx.db.insertInto("site_domain").values({ host, site_id: id, workspace_id: ctx.workspaceId }).execute();
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw conflict("domain_taken", "that domain is already attached to a site");
        throw e;
      }
      ctx.resolver.invalidateSite(id);
      return siteView(ctx, site);
    },
  }),
  route({
    name: "removeDomain", method: "DELETE", path: "/sites/:siteId/domains/:host",
    description: "Detach a custom domain from the site.",
    request: z.object({ siteId, host: z.string().min(3) }), response: anyObject,
    handler: async (ctx, { siteId: id, host }) => {
      const site = await loadSite(ctx, id);
      const h = normalizeHost(host);
      const res = await ctx.db.deleteFrom("site_domain").where("site_id", "=", id).where("host", "=", h ?? "").executeTakeFirst();
      if (!Number(res.numDeletedRows)) throw notFound("domain_not_found");
      ctx.resolver.invalidateSite(id);
      return siteView(ctx, site);
    },
  }),
];
