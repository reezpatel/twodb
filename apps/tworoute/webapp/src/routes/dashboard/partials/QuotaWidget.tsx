import { useSharedConnections } from "../../../lib/connections-context.js";
import type { QuotaSnapshot } from "../../../lib/tworoute-client.js";
import { Shell } from "./WidgetBits.js";

/**
 * Quota widget — REAL analytics: renders the workspace's live quota
 * snapshots (llm_quota, fed by the refresh-quotas collectors). Per-connection
 * scope shows that connection's windows; the aggregate board shows every
 * connection's windows grouped by connection. Bars are 30px tall, 8-segment
 * quota blocks (legacy's QuotaBlocks design) for ratio-based windows and
 * full-height bars for balances.
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

function toneFor(ratio: number | null): string {
  if (ratio === null) return "bg-ink-muted";
  if (ratio > 0.8) return "bg-destructive";
  if (ratio >= 0.5) return "bg-warning";
  return "bg-success";
}

function fmtValue(q: QuotaSnapshot): string {
  if (q.unit === "percent") return `${Math.round(q.quotaUsed)}%`;
  if (q.unit === "usd") return `$${q.quotaUsed.toFixed(2)}${q.quotaTotal ? ` / $${q.quotaTotal.toFixed(0)}` : " left"}`;
  return `${q.quotaUsed.toLocaleString()}${q.quotaTotal ? ` / ${q.quotaTotal.toLocaleString()} ${q.unit}` : ` ${q.unit}`}`;
}

/** 8-segment quota blocks — legacy's QuotaBlocks, 30px tall. */
function QuotaBlocks({ ratio }: { ratio: number }) {
  const filled = Math.round(ratio * BLOCKS);
  const tone = toneFor(ratio);
  return (
    <div className="flex flex-col" style={{ height: 30 }}>
      <div className="flex items-end gap-1" style={{ height: 30 }} role="img" aria-label={`${Math.round(ratio * 100)}% used`}>
        {Array.from({ length: BLOCKS }, (_, i) => (
          <span key={i} className={`w-3 flex-1 rounded-[1px] ${i < filled ? tone : "bg-ink/10"}`} style={{ height: 30 }} />
        ))}
      </div>
    </div>
  );
}

/** One quota window row: label + value + blocks + countdown. */
function QuotaRow({ q }: { q: QuotaSnapshot }) {
  const ratio = q.quotaTotal ? q.quotaUsed / q.quotaTotal : q.unit === "percent" ? q.quotaUsed / 100 : null;
  const countdown = until(q.resetAt);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-ink">{q.quotaType}</span>
        <span className="shrink-0 text-[12px] text-ink-muted tabular-nums">
          {fmtValue(q)}
          {countdown ? <span className="text-ink-muted/70"> · {countdown}</span> : null}
        </span>
      </div>
      {ratio !== null ? <QuotaBlocks ratio={Math.min(1, ratio)} /> : <div style={{ height: 4 }} />}
    </div>
  );
}

export function QuotaWidget({ scope }: { scope: string | null }) {
  const { quotas, connections, busy, refreshAllQuotas } = useSharedConnections();
  const scoped = scope
    ? quotas.filter((q) => {
        const conn = connections.find((c) => c.id === q.connectionId);
        return conn?.name === scope;
      })
    : quotas;

  return (
    <Shell
      title="Quotas"
      meta={scoped.length ? `${scoped.length} windows` : busy ? "loading…" : "live"}
    >
      {scoped.length === 0 ? (
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
      ) : scope ? (
        <div className="mt-auto flex flex-col gap-3">
          {scoped.map((q) => (
            <QuotaRow key={q.id} q={q} />
          ))}
        </div>
      ) : (
        // Aggregate: group windows by connection.
        <div className="mt-auto flex flex-col gap-3">
          {connections
            .filter((c) => scoped.some((q) => q.connectionId === c.id))
            .map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                <p className="truncate text-[11px] font-semibold tracking-wide text-ink-muted uppercase">{c.name}</p>
                {scoped
                  .filter((q) => q.connectionId === c.id)
                  .map((q) => (
                    <QuotaRow key={q.id} q={q} />
                  ))}
              </div>
            ))}
        </div>
      )}
    </Shell>
  );
}
