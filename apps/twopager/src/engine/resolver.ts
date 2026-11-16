import type { Db } from "../db/schema.js";
import { parseSiteConfig, type SiteConfig } from "./siteconfig.js";
import type { FileEntry } from "./match.js";

export interface LiveSite {
  siteId: string;
  versionId: string;
  versionNumber: number;
  config: SiteConfig;
  files: Map<string, FileEntry>;
}

const HOST_TTL_MS = 10_000;
const MAX_VERSIONS = 100;

export function normalizeHost(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]!.trim().toLowerCase();
  const h = first.startsWith("[") ? first.slice(1, first.indexOf("]")) : first.replace(/:\d+$/, "");
  return h.replace(/\.$/, "") || null;
}

/**
 * host -> live version, kept in memory. Finalized versions are immutable so they are cached by id;
 * the host -> active-version pointer expires after a few seconds (and is dropped immediately on local changes),
 * so activations made through any replica become visible quickly.
 */
export class SiteResolver {
  private hosts = new Map<string, { at: number; siteId: string | null; versionId: string | null; versionNumber: number }>();
  private versions = new Map<string, { config: SiteConfig; files: Map<string, FileEntry> }>();

  constructor(
    private db: Db,
    private sitesDomain: string | null,
  ) {}

  async forHost(host: string): Promise<LiveSite | null> {
    let ptr = this.hosts.get(host);
    if (!ptr || Date.now() - ptr.at > HOST_TTL_MS) {
      ptr = { at: Date.now(), ...(await this.lookup(host)) };
      this.hosts.set(host, ptr);
      if (this.hosts.size > 10_000) this.hosts.clear();
    }
    if (!ptr.siteId || !ptr.versionId) return null;
    const v = await this.loadVersion(ptr.versionId);
    return v ? { siteId: ptr.siteId, versionId: ptr.versionId, versionNumber: ptr.versionNumber, ...v } : null;
  }

  invalidateSite(siteId: string) {
    for (const [h, p] of this.hosts) if (p.siteId === siteId) this.hosts.delete(h);
    // a host that was unknown before may now belong to the site
    for (const [h, p] of this.hosts) if (!p.siteId) this.hosts.delete(h);
  }

  forgetVersion(versionId: string) {
    this.versions.delete(versionId);
  }

  private async lookup(host: string) {
    const miss = { siteId: null as string | null, versionId: null as string | null, versionNumber: 0 };
    let row: { id: string; active_version_id: string | null } | undefined = await this.db
      .selectFrom("site_domain")
      .innerJoin("site", "site.id", "site_domain.site_id")
      .select(["site.id as id", "site.active_version_id as active_version_id"])
      .where("site_domain.host", "=", host)
      .executeTakeFirst();
    if (!row && this.sitesDomain && host.endsWith(`.${this.sitesDomain}`)) {
      const slug = host.slice(0, -(this.sitesDomain.length + 1));
      if (slug && !slug.includes(".")) row = await this.db.selectFrom("site").select(["id", "active_version_id"]).where("slug", "=", slug).executeTakeFirst();
    }
    if (!row) return miss;
    if (!row.active_version_id) return { ...miss, siteId: row.id };
    const v = await this.db.selectFrom("site_version").select("number").where("id", "=", row.active_version_id).executeTakeFirst();
    return { siteId: row.id, versionId: row.active_version_id, versionNumber: Number((v as any)?.number ?? 0) };
  }

  private async loadVersion(versionId: string) {
    const hit = this.versions.get(versionId);
    if (hit) {
      this.versions.delete(versionId); // LRU: re-insert as most recent
      this.versions.set(versionId, hit);
      return hit;
    }
    const ver = await this.db.selectFrom("site_version").select("config").where("id", "=", versionId).executeTakeFirst();
    if (!ver) return null;
    const rows = await this.db.selectFrom("site_file").select(["path", "sha256", "size", "content_type"]).where("version_id", "=", versionId).execute();
    const files = new Map<string, FileEntry>();
    for (const r of rows as any[]) files.set(r.path, { path: r.path, sha256: r.sha256, size: Number(r.size), contentType: r.content_type });
    let config: SiteConfig;
    try { config = parseSiteConfig((ver as any).config); } catch { config = {}; }
    const entry = { config, files };
    this.versions.set(versionId, entry);
    if (this.versions.size > MAX_VERSIONS) this.versions.delete(this.versions.keys().next().value!);
    return entry;
  }
}
