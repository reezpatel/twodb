import { Big, Delta, Dot, Row, Shell } from "./WidgetBits.js";
import type { SummaryRow, ToolStat } from "../hooks/useAnalytics.js";
import type { Connection, CachedModel } from "../../../lib/tworoute-client.js";

/**
 * Analytics widgets fed by /analytics/summary (24h) — tokens, cost, status,
 * latency, models — all real data derived from the usage_log. Cost is
 * computed against each model's cached per-million prices; rows without a
 * cached price contribute no cost (never a fake number).
 */

const fmt = (v: number) => v.toLocaleString("en-US");
const duration = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`);

export function TokensWidget({ rows }: { rows: SummaryRow[] }) {
  const inTok = rows.reduce((a, r) => a + r.inputTokens, 0);
  const outTok = rows.reduce((a, r) => a + r.outputTokens, 0);
  return (
    <Shell title="Tokens" meta="24h">
      <Big unit="tokens">{inTok + outTok > 1_000_000 ? `${((inTok + outTok) / 1e6).toFixed(1)}M` : fmt(inTok + outTok)}</Big>
      <dl className="mt-auto space-y-2">
        <Row value={fmt(inTok)}>
          <Dot tone="idle" />
          input
        </Row>
        <Row value={fmt(outTok)}>
          <Dot tone="idle" />
          output
        </Row>
      </dl>
    </Shell>
  );
}

export function CostWidget({
  rows,
  modelsByConnection,
}: {
  rows: SummaryRow[];
  modelsByConnection: Map<string, CachedModel[]>;
}) {
  // cost = in/1M * priceIn + out/1M * priceOut, per model with cached prices.
  let cost = 0;
  const perModel: Array<{ model: string; cost: number }> = [];
  for (const r of rows) {
    const m = modelsByConnection.get(r.connectionId)?.find((x) => x.modelId === r.model);
    if (!m?.costInput || !m?.costOutput) continue;
    const c = (r.inputTokens / 1e6) * m.costInput + (r.outputTokens / 1e6) * m.costOutput;
    cost += c;
    perModel.push({ model: r.model, cost: c });
  }
  perModel.sort((a, b) => b.cost - a.cost);

  return (
    <Shell title="Cost" meta="24h · from cached prices">
      <Big unit="est.">${cost.toFixed(2)}</Big>
      {perModel.length ? (
        <dl className="mt-auto space-y-2">
          {perModel.slice(0, 4).map((p) => (
            <Row key={p.model} value={`$${p.cost.toFixed(2)}`}>
              <span className="truncate">{p.model}</span>
            </Row>
          ))}
        </dl>
      ) : (
        <p className="mt-auto text-[13px] text-ink-muted">No priced models in this window — refresh models to cache costs.</p>
      )}
    </Shell>
  );
}

export function StatusWidget({ rows }: { rows: SummaryRow[] }) {
  const completed = rows.reduce((a, r) => a + r.completed, 0);
  const failed = rows.reduce((a, r) => a + r.failed, 0);
  const total = completed + failed;
  const rate = total > 0 ? (completed / total) * 100 : 100;
  const hasErrors = failed > 0;
  return (
    <Shell title="Status" meta="24h">
      <Big unit="success">{rate.toFixed(1)}%</Big>
      <p className={`mt-3 flex items-center gap-2 text-[13px] ${hasErrors ? "text-warning" : "text-ink"}`}>
        <Dot tone={hasErrors ? "warn" : "ok"} pulse />
        <span className="truncate">
          {total === 0 ? "No calls in this window" : `${fmt(completed)} completed · ${fmt(failed)} failed`}
        </span>
      </p>
      <dl className="mt-auto space-y-2">
        <Row value={fmt(total)}>
          <Dot tone="idle" />
          total calls
        </Row>
      </dl>
    </Shell>
  );
}

export function LatencyWidget({ rows }: { rows: SummaryRow[] }) {
  const withLatency = rows.filter((r) => r.avgLatencyMs !== null);
  // Weighted avg + max-of-p95 across models (simple, honest).
  const totalCalls = withLatency.reduce((a, r) => a + r.calls, 0);
  const avg = totalCalls > 0 ? withLatency.reduce((a, r) => a + (r.avgLatencyMs ?? 0) * r.calls, 0) / totalCalls : null;
  const p95 = withLatency.length ? Math.max(...withLatency.map((r) => r.p95LatencyMs ?? 0)) : null;
  return (
    <Shell title="Latency" meta="24h">
      <Big unit="avg">{avg === null ? "—" : duration(avg)}</Big>
      <dl className="mt-auto space-y-2">
        <Row value={p95 === null || p95 === 0 ? "—" : duration(p95)}>
          <Dot tone="warn" />
          p95
        </Row>
        <Row value={fmt(totalCalls)}>
          <Dot tone="idle" />
          calls
        </Row>
      </dl>
    </Shell>
  );
}

export function ModelsWidget({ rows }: { rows: SummaryRow[] }) {  // Per-model token share over 24h.
  const byModel = new Map<string, number>();
  for (const r of rows) byModel.set(r.model, (byModel.get(r.model) ?? 0) + r.inputTokens + r.outputTokens);
  const entries = [...byModel.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  const top = entries.slice(0, 4);
  const otherShare = entries.length > 4 ? entries.slice(4).reduce((a, [, v]) => a + v, 0) : 0;

  const swatch = (i: number) => (i === 0 ? "bg-ion-deep" : i === 1 ? "bg-ion-deep/60" : "bg-ion-deep/35");
  const shareOf = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : "0%");

  return (
    <Shell title="Token usage" meta="by model · 24h">
      <Big unit="tokens">{total > 1e6 ? `${(total / 1e6).toFixed(1)}M` : fmt(total)}</Big>
      <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2">
        {top.map(([model, v], i) => (
          <Row key={model} value={shareOf(v)}>
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${swatch(i)}`} />
            <span className="truncate">{model}</span>
          </Row>
        ))}
        {otherShare > 0 ? (
          <Row value={shareOf(otherShare)}>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-ink/20" />
            <span className="truncate">other</span>
          </Row>
        ) : null}
      </dl>
      <div role="img" aria-label="Share of tokens by model" className="mt-4 flex h-[3px] gap-[3px]">
        {top.map(([model, v], i) => (
          <span key={model} className={`h-full rounded-full ${swatch(i)}`} style={{ width: shareOf(v) }} />
        ))}
        {otherShare > 0 ? <span className="h-full rounded-full bg-ink/20" style={{ width: shareOf(otherShare) }} /> : null}
      </div>
    </Shell>
  );
}

/** Errors — real: failed call counts per model over the window. */
export function ErrorsWidget({ rows }: { rows: SummaryRow[] }) {
  const total = rows.reduce((a, r) => a + r.failed, 0);
  const calls = rows.reduce((a, r) => a + r.calls, 0);
  const rate = calls > 0 ? (total / calls) * 100 : 0;
  const failedModels = rows
    .filter((r) => r.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 3);

  return (
    <Shell title="Errors" meta="24h">
      <Big unit={`${rate.toFixed(1)}% rate`}>{total}</Big>
      {failedModels.length ? (
        <dl className="mt-auto space-y-2">
          {failedModels.map((r) => (
            <Row key={r.connectionId + r.model} value={r.failed}>
              <Dot tone="err" />
              <span className="truncate">{r.model}</span>
            </Row>
          ))}
        </dl>
      ) : (
        <p className="mt-auto text-[13px] text-ink-muted">No failed calls — clean window.</p>
      )}
    </Shell>
  );
}

/**
 * Tool calls — REAL: per-tool invocation counts from /analytics/tools (24h).
 * Rows come from assistant-chosen tool_calls parsed out of completion
 * responses, plus direct POST /tools/invoke logs.
 */
export function ToolCallsWidget({ tools }: { tools: ToolStat[] }) {
  const total = tools.reduce((a, t) => a + t.calls, 0);
  const failed = tools.reduce((a, t) => a + t.failed, 0);
  const sorted = [...tools].sort((a, b) => b.calls - a.calls);
  const max = sorted[0]?.calls ?? 1;

  return (
    <Shell
      title="Tool calls"
      meta={
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="tabular-nums">24h</span>
          {failed > 0 ? <span className="text-destructive tabular-nums">· {failed} failed</span> : null}
        </span>
      }
    >
      <Big>{fmt(total)}</Big>
      {sorted.length ? (
        <table className="mt-auto w-full table-fixed text-left text-[13px]">
          <caption className="sr-only">Tool calls in the last 24 hours</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">tool</th>
              <th scope="col">share</th>
              <th scope="col">calls</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.name}>
                <th
                  scope="row"
                  className={`w-[140px] truncate py-[6px] pr-3 font-normal ${i === 0 ? "text-ink" : "text-ink-muted"}`}
                >
                  {t.name}
                </th>
                <td className="py-[6px]">
                  <span aria-hidden="true" className="block h-[3px] rounded-full bg-ink/10">
                    <span
                      className={`block h-full rounded-full transition-[width] duration-700 ${i === 0 ? "bg-ion-deep" : "bg-ink/25"}`}
                      style={{ width: `${(t.calls / max) * 100}%` }}
                    />
                  </span>
                </td>
                <td className="w-[56px] py-[6px] text-right text-ink-muted tabular-nums">{t.calls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-auto text-[13px] text-ink-muted">
          No tool invocations yet — assistant tool_calls and POST /tools/invoke land here.
        </p>
      )}
    </Shell>
  );
}
