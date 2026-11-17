import { useMemo } from "react";
import type { QuotaConnection, QuotaSnapshot } from "../../../lib/artisan-client.js";
import { useProviderQuota } from "../hooks/useProviderQuota.js";
import { SideSection } from "./SidePanel.js";

/**
 * Provider section — live usage-quota windows per TwoRoute connection, in the
 * style of TwoRoute's dashboard "Quotas by connection" widget: one entry per
 * connection, ratio windows as 8-segment blocks (info → warning → destructive),
 * balances as text.
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
    <div className="flex items-end gap-1" style={{ height: 10 }} role="img" aria-label={`${Math.round(ratio * 100)}% used`}>
      {Array.from({ length: BLOCKS }, (_, i) => (
        <span key={i} className={`w-2 flex-1 rounded-[1px] ${i < filled ? tone : "bg-info/15"}`} style={{ height: 10 }} />
      ))}
    </div>
  );
}

function ConnectionEntry({ connection, quotas }: { connection: QuotaConnection; quotas: QuotaSnapshot[] }) {
  const worst = quotas.reduce<number | null>((w, q) => {
    const r = ratioOf(q);
    return r !== null && (w === null || r > w) ? r : w;
  }, null);
  const sorted = [...quotas].sort((a, b) => (ratioOf(b) ?? -1) - (ratioOf(a) ?? -1));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="truncate text-[12px] font-medium text-ink">{connection.name}</span>
        <span className="truncate text-[10px] text-ink-muted/80">{connection.provider}</span>
        <span className={`ml-auto shrink-0 text-[10px] font-medium tabular-nums ${textToneFor(worst)}`}>
          {worst !== null ? `${Math.round(worst * 100)}% used` : `${quotas.length} windows`}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 border-l border-outline/60 pl-2.5">
        {sorted.map((q) => {
          const ratio = ratioOf(q);
          const countdown = until(q.resetAt);
          return (
            <div key={q.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-ink">{q.quotaType}</span>
                <span className="shrink-0 text-[10px] text-ink-muted tabular-nums">
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

export function ProviderSection() {
  const { connections, quotas, error } = useProviderQuota();

  const entries = useMemo(
    () =>
      connections
        .map((c) => ({ connection: c, quotas: quotas.filter((q) => q.connectionId === c.id) }))
        .filter((e) => e.quotas.length > 0)
        .sort((a, b) => a.connection.name.localeCompare(b.connection.name)),
    [connections, quotas],
  );

  return (
    <SideSection title="Provider" count={entries.length ? `${entries.length} connection${entries.length === 1 ? "" : "s"}` : undefined}>
      {entries.length === 0 ? (
        <p className="py-1 text-[11px] text-ink-muted">{error ? `quota unavailable: ${error}` : "No quota snapshots yet — refresh quotas in TwoRoute."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) => (
            <ConnectionEntry key={e.connection.id} connection={e.connection} quotas={e.quotas} />
          ))}
        </div>
      )}
    </SideSection>
  );
}

