import { Big, Delta, Dot, Row, Shell } from "./WidgetBits.js";

/**
 * Mocked dashboard widgets — the shapes we'll eventually feed from the
 * usage_log / llm_quota / llm_model tables. Deterministic per (scope, seed)
 * so the aggregate dashboard and per-connection ones differ but are stable.
 * All data is FAKE for now (deliberate: finalize the dashboard first, then
 * back it with real tables).
 */

const fmt = (v: number) => v.toLocaleString("en-US");
const duration = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`);

function noise(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Calls heatmap — last 14 days, one cell per half-day. */
export function CallsWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 28 }, (_, i) => Math.round(noise(h + i) * 9));
  const today = cells.reduce((a, b) => a + b, 0);
  const peak = Math.max(...cells);
  return (
    <Shell title="Calls" meta={<Delta value={12} />}>
      <Big>{fmt(today * 37 + 214)}</Big>
      <div className="mt-auto">
        <div
          role="img"
          aria-label={`Calls over the last 14 days, peak ${peak} per interval.`}
          className="grid h-16 grid-cols-14 gap-[3px]"
        >
          {cells.map((v, i) => (
            <span
              key={i}
              title={`${v} calls`}
              className={`rounded-[2.5px] ${
                v > peak * 0.75 ? "bg-ion-deep/85" : v > peak * 0.5 ? "bg-ion-deep/50" : v > peak * 0.25 ? "bg-ion-deep/25" : "bg-ink/10"
              }`}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function TokensWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const inTok = Math.round(1.1e6 + noise(h) * 3e6);
  const outTok = Math.round(4e5 + noise(h + 1) * 1.5e6);
  return (
    <Shell title="Tokens" meta="24h">
      <Big unit="tokens">{((inTok + outTok) / 1e6).toFixed(1)}M</Big>
      <dl className="mt-auto space-y-2">
        <Row value={fmt(inTok)}>input</Row>
        <Row value={fmt(outTok)}>output</Row>
      </dl>
    </Shell>
  );
}

export function CostWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const days = Array.from({ length: 14 }, (_, i) => Math.round(9 + noise(h + i * 5) * 7 + i * 0.35));
  const max = Math.max(...days);
  const month = 184.2 + noise(h + 99) * 60;
  return (
    <Shell
      title="Cost"
      meta={
        <Delta value={8} good="down" />
      }
    >
      <Big unit="MTD">${month.toFixed(0)}</Big>
      <div
        role="img"
        aria-label={`Daily cost over the last 14 days, up to $${max}.`}
        className="mt-auto flex h-10 items-end gap-[3px]"
      >
        {days.map((d, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full transition-[height] duration-700 ${i === days.length - 1 ? "bg-ion-deep" : "bg-ink/15"}`}
            style={{ height: `${(d / max) * 100}%` }}
          />
        ))}
      </div>
    </Shell>
  );
}

export function LatencyWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const p50 = 400 + noise(h) * 900;
  const p95 = p50 * 2.4;
  const errRate = (noise(h + 3) * 2.4).toFixed(1);
  return (
    <Shell title="Latency" meta="p50 / p95">
      <Big unit="p50">{duration(p50)}</Big>
      <dl className="mt-auto space-y-2">
        <Row value={duration(p95)}>
          <Dot tone="warn" />
          p95
        </Row>
        <Row value={`${errRate}%`}>
          <Dot tone="err" />
          errors
        </Row>
      </dl>
    </Shell>
  );
}

export function QuotaWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const used = Math.round(20 + noise(h) * 65);
  const reset = noise(h + 2) > 0.5;
  return (
    <Shell title="Quota" meta={reset ? "resets in 2h 14m" : "monthly"}>
      <Big unit="% used">{used}</Big>
      <div className="mt-auto">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
          <span
            className={`block h-full rounded-full ${used > 85 ? "bg-destructive" : used > 60 ? "bg-warning" : "bg-success"}`}
            style={{ width: `${used}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-ink-muted">5h window — usage-based smoothing</p>
      </div>
    </Shell>
  );
}

export function ModelsWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const models = [
    { name: "claude-sonnet-5", share: 0.42 + noise(h) * 0.15 },
    { name: "claude-haiku-4.5", share: 0.2 + noise(h + 1) * 0.12 },
    { name: "gpt-5.2", share: 0.08 + noise(h + 2) * 0.08 },
  ];
  const rest = Math.max(0.05, 1 - models.reduce((a, m) => a + m.share, 0));
  models.push({ name: "other", share: rest });
  return (
    <Shell title="Token usage" meta="by model · 24h">
      <Big unit="tokens">12.3M</Big>
      <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2">
        {models.map((m, i) => (
          <Row key={m.name} value={`${Math.round(m.share * 100)}%`}>
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${i === 0 ? "bg-ion-deep" : "bg-ion-deep/50"}`} />
            <span className="truncate">{m.name}</span>
          </Row>
        ))}
      </dl>
      <div role="img" aria-label={`Share of tokens by model.`} className="mt-4 flex h-[3px] gap-[3px]">
        {models.map((m) => (
          <span key={m.name} className="h-full rounded-full bg-ion-deep/60" style={{ width: `${m.share * 100}%` }} />
        ))}
      </div>
    </Shell>
  );
}

export function StatusWidget({ seed }: { seed: string }) {
  const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const healthy = noise(h) > 0.25;
  return (
    <Shell title="Status" meta="30d">
      <Big unit="uptime">99.9{Math.floor(noise(h + 7) * 9)}%</Big>
      <p className={`mt-3 flex items-center gap-2 text-[13px] ${healthy ? "text-ink" : "text-warning"}`}>
        <Dot tone={healthy ? "ok" : "warn"} pulse />
        <span className="truncate">{healthy ? "All systems operational" : "Degraded — upstream latency"}</span>
      </p>
      <div className="mt-auto">
        <div role="img" aria-label="Uptime over the last 30 days." className="flex h-5 gap-[2px]">
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} className={`flex-1 rounded-[1.5px] ${noise(h + i) > 0.93 ? "bg-warning/80" : "bg-ink/15"}`} />
          ))}
        </div>
      </div>
    </Shell>
  );
}
