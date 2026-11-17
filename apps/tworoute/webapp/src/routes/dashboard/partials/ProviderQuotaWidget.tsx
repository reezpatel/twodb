import { useSharedConnections } from "../../../lib/connections-context.js";
import { ProviderLogo } from "../../../lib/provider-logo.js";
import type { Connection, QuotaSnapshot } from "../../../lib/tworoute-client.js";
import { Shell } from "./WidgetBits.js";

/**
 * Quotas by connection — every connection's live quota windows
 * (llm_quota snapshots), one entry per connection. On the aggregate board
 * (scope=null) entries are grouped under their provider; on a connection's
 * board only that connection's windows show. Ratio windows get 8-segment
 * blocks on theme tones (info → warning → destructive), balances render as
 * text. Empty state offers the refresh-all action.
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

/** One connection's entry: name + provider chip, then its quota windows. */
function ConnectionEntry({
  connection,
  providerLabel,
  quotas,
  showProvider,
}: {
  connection: Connection;
  providerLabel: string;
  quotas: QuotaSnapshot[];
  showProvider: boolean;
}) {
  const worst = quotas.reduce<number | null>((w, q) => {
    const r = ratioOf(q);
    return r !== null && (w === null || r > w) ? r : w;
  }, null);
  const sorted = [...quotas].sort((a, b) => (ratioOf(b) ?? -1) - (ratioOf(a) ?? -1));
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <ProviderLogo provider={connection.provider} className="size-4 shrink-0" />
        <span className="truncate text-[13px] font-semibold text-ink">{connection.name}</span>
        {showProvider ? <span className="truncate text-[11px] text-ink-muted/80">{providerLabel}</span> : null}
        <span className={`ml-auto shrink-0 text-[11px] font-medium tabular-nums ${textToneFor(worst)}`}>
          {worst !== null ? `${Math.round(worst * 100)}% used` : `${quotas.length} windows`}
        </span>
      </div>
      <div className="flex flex-col gap-2 border-l border-outline/60 pl-3">
        {sorted.map((q) => {
          const ratio = ratioOf(q);
          const countdown = until(q.resetAt);
          return (
            <div key={q.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] text-ink">{q.quotaType}</span>
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
  );
}

export function ProviderQuotaWidget({ scope }: { scope: string | null }) {
  const { quotas, connections, providers, busy, refreshAllQuotas } = useSharedConnections();

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  // One entry per connection (that has snapshots); scoped boards keep only
  // their own connection.
  const scopedConnections = scope ? connections.filter((c) => c.name === scope) : connections;
  const entries = scopedConnections
    .map((c) => ({ connection: c, quotas: quotas.filter((q) => q.connectionId === c.id) }))
    .filter((e) => e.quotas.length > 0);

  // Aggregate board: group entries by provider (providers sorted by label,
  // connections by name inside). Scoped board: the single entry, ungrouped.
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = scope ? "_all" : e.connection.provider;
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  }
  const sortedGroups = [...groups.entries()]
    .map(([provider, es]) => ({ provider, entries: [...es].sort((a, b) => a.connection.name.localeCompare(b.connection.name)) }))
    .sort((a, b) => providerLabel(a.provider).localeCompare(providerLabel(b.provider)));

  return (
    <Shell
      title={scope ? "Quotas" : "Quotas by connection"}
      meta={entries.length ? `${entries.length} connection${entries.length === 1 ? "" : "s"}` : busy ? "loading…" : "live"}
    >
      {entries.length === 0 ? (
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
          {sortedGroups.map((g) => (
            <div key={g.provider} className="flex shrink-0 flex-col gap-3">
              {!scope ? (
                <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{providerLabel(g.provider)}</p>
              ) : null}
              {g.entries.map((e) => (
                <ConnectionEntry
                  key={e.connection.id}
                  connection={e.connection}
                  providerLabel={providerLabel(e.connection.provider)}
                  quotas={e.quotas}
                  showProvider={!scope}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
