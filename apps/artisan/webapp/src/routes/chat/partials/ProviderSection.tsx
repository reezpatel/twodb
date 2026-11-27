import { useMemo } from "react";
import type { QuotaConnection, QuotaSnapshot } from "../../../lib/artisan-client.js";
import { useProviderQuota } from "../hooks/useProviderQuota.js";

/**
 * Provider section — live usage-quota windows per TwoRoute connection, in the
 * style of TwoRoute's dashboard "Quotas by connection" widget: one entry per
 * connection, each window as a circular progress ring (info → warning →
 * destructive as it fills) with the percentage in the centre, remaining/total
 * beside it and the reset countdown below (exact time on hover).
 */

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

function textToneFor(ratio: number | null): string {
  if (ratio === null) return "text-ink-muted";
  if (ratio > 0.8) return "text-destructive";
  if (ratio >= 0.5) return "text-warning";
  return "text-info";
}

const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

/** "<remaining> / <total>" for windows with a limit; a plain balance otherwise. */
function fmtRemaining(q: QuotaSnapshot): string {
  const total = q.quotaTotal ?? (q.unit === "percent" ? 100 : null);
  if (total === null) return q.unit === "usd" ? `$${q.quotaUsed.toFixed(2)} left` : `${num(q.quotaUsed)} ${q.unit}`;
  const left = Math.max(0, total - q.quotaUsed);
  if (q.unit === "usd") return `$${left.toFixed(2)} / $${num(total)}`;
  if (q.unit === "percent") return `${num(left)}% / ${num(total)}%`;
  return `${num(left)} / ${num(total)} ${q.unit}`;
}

function resetTitle(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return `Resets ${new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

const RING = 36;
const STROKE = 4;

/** Circular progress; stroke colour shifts info → warning → destructive as it fills. */
function QuotaRing({ ratio }: { ratio: number }) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const text = textToneFor(ratio);
  return (
    <div className="relative shrink-0" style={{ width: RING, height: RING }} role="img" aria-label={`${Math.round(ratio * 100)}% used`}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className={`-rotate-90 ${text}`}>
        <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={STROKE} />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums ${text}`}>{Math.round(ratio * 100)}%</span>
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="truncate text-[12px] font-medium text-ink">{connection.name}</span>
        <span className="truncate text-[10px] text-ink-muted/80">{connection.provider}</span>
        <span className={`ml-auto shrink-0 text-[10px] font-medium tabular-nums ${textToneFor(worst)}`}>
          {worst !== null ? `${Math.round(worst * 100)}% used` : `${quotas.length} windows`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {sorted.map((q) => {
          const ratio = ratioOf(q);
          const countdown = until(q.resetAt);
          return (
            <div key={q.id} className="flex min-w-0 items-center gap-2.5" title={resetTitle(q.resetAt)}>
              {ratio !== null ? <QuotaRing ratio={ratio} /> : null}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[11px] text-ink">{q.quotaType}</span>
                <span className="truncate text-[11px] tabular-nums text-ink-muted">{fmtRemaining(q)}</span>
                {countdown ? <span className="truncate text-[10px] text-ink-muted/70">resets in {countdown}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProviderSection(props: { model: string | null }) {
  const { connections, quotas, error } = useProviderQuota(props.model);

  const entries = useMemo(
    () =>
      connections
        .map((c) => ({ connection: c, quotas: quotas.filter((q) => q.connectionId === c.id) }))
        .filter((e) => e.quotas.length > 0)
        .sort((a, b) => a.connection.name.localeCompare(b.connection.name)),
    [connections, quotas],
  );

  return (
    <div data-slot="provider-section">
      <div className="px-3 py-3">
        {!props.model ? (
          <p className="py-1 text-[11px] text-ink-muted">No model selected for this session.</p>
        ) : entries.length === 0 ? (
          <p className="py-1 text-[11px] text-ink-muted">{error ? `quota unavailable: ${error}` : `No quota snapshots for this provider — refresh quotas in TwoRoute.`}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((e) => (
              <ConnectionEntry key={e.connection.id} connection={e.connection} quotas={e.quotas} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
