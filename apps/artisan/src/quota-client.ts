import type { ArtisanConfig } from "./config.js";

/**
 * Provider quota snapshots — Artisan proxies TwoRoute's workspace-scoped
 * quota endpoints (`GET /quotas`, `GET /connections`) so the webapp can render
 * a per-connection usage section in the sidebar without a second auth path.
 * Auth is the same forwarded workspace key used for model calls.
 */

export interface QuotaSnapshot {
  id: string;
  connectionId: string;
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  capturedAt: string;
  resetAt: string | null;
}

export interface QuotaConnection {
  id: string;
  name: string;
  provider: string;
}

export class QuotaClient {
  constructor(
    private readonly config: ArtisanConfig,
    private readonly credential: string,
  ) {}

  private async call<T>(path: string): Promise<T> {
    const res = await fetch(`${this.config.TWOROUTE_URL}${path}`, {
      headers: { authorization: `Bearer ${this.credential}` },
    });
    if (!res.ok) throw new Error(`tworoute ${path} ${res.status}`);
    return (await res.json()) as T;
  }

  /** Workspace-visible connections + their latest quota snapshots. */
  async quotas(): Promise<{ connections: QuotaConnection[]; quotas: QuotaSnapshot[] }> {
    const [conns, quotas] = await Promise.all([
      this.call<{ connections?: QuotaConnection[] } | QuotaConnection[]>("/connections"),
      this.call<{ quotas?: QuotaSnapshot[] } | QuotaSnapshot[]>("/quotas"),
    ]);
    const connections = (Array.isArray(conns) ? conns : (conns.connections ?? []))
      .map((c) => ({ id: c.id, name: c.name, provider: c.provider }));
    return { connections, quotas: Array.isArray(quotas) ? quotas : (quotas.quotas ?? []) };
  }
}

