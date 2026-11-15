import { useState } from "react";

/** Dependency-free SVG charts. Values are plain numbers; callers pass a formatter for axis/tooltip text. */
const W = 640;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export interface BarSeries { name: string; color: string; values: number[] }

export function BarChart({ labels, series, fmt, height = 220 }: { labels: string[]; series: BarSeries[]; fmt: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const padL = 56, padB = 24, padT = 8, h = height - padB - padT, w = W - padL - 8;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const gw = w / Math.max(1, labels.length), bw = Math.min(26, (gw * 0.7) / series.length);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={padT + h - h * t} y2={padT + h - h * t} stroke="currentColor" opacity={0.1} />
            <text x={padL - 6} y={padT + h - h * t + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.6}>{fmt(max * t)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          const x0 = padL + gw * i + (gw - bw * series.length) / 2;
          return (
            <g key={l + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + gw * i} y={padT} width={gw} height={h} fill="transparent" />
              {hover === i ? <rect x={padL + gw * i} y={padT} width={gw} height={h} fill="currentColor" opacity={0.05} /> : null}
              {series.map((s, j) => {
                const bh = (Math.max(0, s.values[i]) / max) * h;
                return <rect key={s.name} x={x0 + bw * j} y={padT + h - bh} width={bw - 2} height={bh} rx={2} fill={s.color} />;
              })}
              <text x={padL + gw * i + gw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6}>{l}</text>
            </g>
          );
        })}
      </svg>
      <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} extra={hover !== null ? `${labels[hover]}: ${series.map((s) => `${s.name} ${fmt(s.values[hover])}`).join(" · ")}` : undefined} />
    </div>
  );
}

export interface LineSeries { name: string; color: string; values: (number | null)[]; dashedFrom?: number }

export function LineChart({ labels, series, fmt, height = 220, area = false, target }: { labels: string[]; series: LineSeries[]; fmt: (n: number) => string; height?: number; area?: boolean; target?: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const padL = 56, padB = 24, padT = 8, h = height - padB - padT, w = W - padL - 12;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (target) all.push(target);
  const lo = Math.min(0, ...all), hi = Math.max(1, ...all);
  const max = niceMax(hi), min = lo < 0 ? -niceMax(-lo) : 0;
  const x = (i: number) => padL + (labels.length <= 1 ? w / 2 : (w * i) / (labels.length - 1));
  const y = (v: number) => padT + h - ((v - min) / (max - min)) * h;
  const path = (vals: (number | null)[], from = 0, to = vals.length - 1) => vals.slice(from, to + 1).map((v, i) => (v === null ? "" : `${i === 0 || vals[from + i - 1] === null ? "M" : "L"}${x(from + i).toFixed(1)},${y(v).toFixed(1)}`)).join(" ");
  const step = Math.max(1, Math.ceil(labels.length / 10));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(labels.length - 1, Math.round(((px - padL) / w) * (labels.length - 1))))); }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => { const v = min + (max - min) * t; return (
          <g key={t}><line x1={padL} x2={W - 12} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.1} /><text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity={0.6}>{fmt(v)}</text></g>
        ); })}
        {target ? <g><line x1={padL} x2={W - 12} y1={y(target)} y2={y(target)} stroke="#f59e0b" strokeDasharray="5 4" /><text x={W - 14} y={y(target) - 4} textAnchor="end" fontSize="10" fill="#f59e0b">target {fmt(target)}</text></g> : null}
        {series.map((s) => {
          const solidTo = s.dashedFrom ?? s.values.length - 1;
          return (
            <g key={s.name}>
              {area ? <path d={`${path(s.values, 0, solidTo)} L${x(solidTo).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`} fill={s.color} opacity={0.12} /> : null}
              <path d={path(s.values, 0, solidTo)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.dashedFrom !== undefined ? <path d={path(s.values, Math.max(0, s.dashedFrom - 0), s.values.length - 1)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray="5 4" /> : null}
              {labels.length <= 24 ? s.values.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />)) : null}
            </g>
          );
        })}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + h} stroke="currentColor" opacity={0.25} /> : null}
        {labels.map((l, i) => (i % step === 0 ? <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6}>{l}</text> : null))}
      </svg>
      <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} extra={hover !== null ? `${labels[hover]}: ${series.map((s) => `${s.name} ${s.values[hover] === null ? "—" : fmt(s.values[hover]!)}`).join(" · ")}` : undefined} />
    </div>
  );
}

export function Donut({ slices, center, size = 170 }: { slices: { name: string; value: number; color: string }[]; center?: React.ReactNode; size?: number }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = 15.9155, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="-rotate-90" width={size} height={size}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" opacity={0.08} strokeWidth="4" />
        {total > 0 ? slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * C, off = acc; acc += len;
          return <circle key={s.name} cx="18" cy="18" r={r} fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}><title>{s.name}</title></circle>;
        }) : null}
      </svg>
      {center ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div> : null}
    </div>
  );
}

export function Legend({ items, extra }: { items: { name: string; color: string }[]; extra?: string }) {
  return (
    <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.map((i) => <span key={i.name} className="inline-flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: i.color }} />{i.name}</span>)}
      {extra ? <span className="ml-auto text-ink">{extra}</span> : null}
    </div>
  );
}

export function Sparkline({ values, color = "#6366f1", width = 120, height = 32 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - lo) / span) * (height - 4)).toFixed(1)}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} /></svg>;
}
