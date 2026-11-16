import { useSharedConnections } from "../../../lib/connections-context.js";
import { ProviderLogo } from "../../../lib/provider-logo.js";
import type { QuotaSnapshot } from "../../../lib/tworoute-client.js";
import { Shell } from "./WidgetBits.js";

/**
 * Provider quotas — the aggregate board's first tile: every provider's live
 * quota windows (llm_quota snapshots), rolled up across that provider's
 * connections. Ratio-based windows become 8-segment blocks; balances/counters
 * render as text. The provider badge shows the worst (highest) ratio across
 * its connections' windows. Empty state offers the same refresh-all action
 * as the per-connection Quotas tile.
 */

const BLOCKS = 8;

function until(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ratioOf(q: QuotaSnapshot): number | null {
  if (q.quotaTotal) return q.quotaUsed / q.quotaTotal;
  if (q.unit === "percent") return q.quotaUsed / 100;
  return null;
}

/** Theme tones: info (ok) → warning → destructive. */
function toneFor(ratio: number | null): string {
  if (ratio === null) return "bg-ink-muted";
  if (ratio > 0.8) return "bg-destructive";
  if (ratio >= 0.5) return "bg-warning";
  return "bg-info";
}

function textToneFor(ratio: number | null): string {
  if (ratio === null) return "text-ink-muted";
  if (ratio > 0.8) return "text-destructive";
  if (ratio >= 0.5) return "text-warning";
  return "text-info";
}

function fmtValue(q: QuotaSnapshot): string {
  if (q.unit === "percent") return `${Math.round(q.quotaUsed)}%`;
  if (q.unit === "usd") return `$${q.quotaUsed.toFixed(2)}${q.quotaTotal ? ` / $${q.quotaTotal.toFixed(0)}` : " left"}`;
  return `${q.quotaUsed.toLocaleString()}${q.quotaTotal ? ` / ${q.quotaTotal.toLocaleString()} ${q.unit}` : ` ${q.unit}`}`;
}

function QuotaBlocks({ ratio }: { ratio: number }) {
  const filled = Math.round(Math.min(1, ratio) * BLOCKS);
  const tone = toneFor(ratio);
  return (
    <div
      className="flex items-end gap-1"
      style={{ height: 14 }}
      role="img"
      aria-label={`${Math.round(ratio * 100)}% used`}
    >
      {Array.from({ length: BLOCKS }, (_, i) => (
        <span key={i} className={`w-3 flex-1 rounded-[1px] ${i < filled ? tone : "bg-info/15"}`} style={{ height: 14 }} />
      ))}
    </div>
  );
}

export function ProviderQuotaWidget() {
  const { quotas, connections, providers, busy, refreshAllQuotas } = useSharedConnections();

  // Group every quota snapshot by its connection's provider. Sort groups by
  // the provider label, windows by worst ratio first.
  const groups = new Map<string, { provider: string; label: string; quotas: QuotaSnapshot[] }>();
  for (const q of quotas) {
    const connection = connections.find((c) => c.id === q.connectionId);
    if (!connection) continue;
    let g = groups.get(connection.provider);
    if (!g) {
      g = {
        provider: connection.provider,
        label: providers.find((p) => p.id === connection.provider)?.label ?? connection.provider,
        quotas: [],
      };
      groups.set(connection.provider, g);
    }
    g.quotas.push(q);
  }
  const sorted = [...groups.values()]
    .map((g) => ({
      ...g,
      quotas: [...g.quotas].sort((a, b) => (ratioOf(b) ?? -1) - (ratioOf(a) ?? -1)),
      worst: g.quotas.reduce<number | null>((w, q) => {
        const r = ratioOf(q);
        return r !== null && (w === null || r > w) ? r : w;
      }, null),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Shell title="Provider quotas" meta={sorted.length ? `${sorted.length} provider${sorted.length === 1 ? "" : "s"}` : busy ? "loading…" : "live"}>
      {sorted.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <p className="text-[13px] text-ink-muted">No quota snapshots yet.</p>
          <button
            className="text-[13px] font-medium text-ink underline-offset-4 hover:underline"
            onClick={() => void refreshAllQuotas()}
            disabled={busy}
          >
            {busy ? "Fetching…" : "Fetch from providers"}
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
          {sorted.map((g) => (
            <div key={g.provider} className="flex shrink-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <ProviderLogo provider={g.provider} className="size-4 shrink-0" />
                <span className="truncate text-[13px] font-semibold text-ink">{g.label}</span>
                <span className={`ml-auto shrink-0 text-[11px] font-medium tabular-nums ${textToneFor(g.worst)}`}>
                  {g.worst !== null ? `${Math.round(g.worst * 100)}% used` : `${g.quotas.length} windows`}
                </span>
              </div>
              <div className="flex flex-col gap-2 border-l border-outline/60 pl-3">
                {g.quotas.map((q) => {
                  const ratio = ratioOf(q);
                  const connectionName = connections.find((c) => c.id === q.connectionId)?.name;
                  const countdown = until(q.resetAt);
                  return (
                    <div key={q.id} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[12px] text-ink">
                          {connectionName ? <span className="text-ink-muted">{connectionName} · </span> : null}
                          {q.quotaType}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-muted tabular-nums">
                          {fmtValue(q)}
                          {countdown ? <span className="text-ink-muted/70"> · {countdown}</span> : null}
                        </span>
                      </div>
                      {ratio !== null ? <QuotaBlocks ratio={ratio} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
