import { Bug, CheckSquare, CircleDot, Sparkles, Wrench, Flag, Bookmark, Zap, type LucideIcon } from "lucide-react";
import type { Priority, StatusCategory } from "../lib/types";
import { priorityMeta } from "../lib/meta";
import { initials } from "../lib/format";

export function StatusIcon({ category, color, size = 14 }: { category: StatusCategory; color: string; size?: number }) {
  const r = 6, c = 8;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
      {category === "backlog" ? <circle cx={c} cy={c} r={r} stroke={color} strokeWidth="1.6" strokeDasharray="2.2 2.2" /> : null}
      {category === "todo" ? <circle cx={c} cy={c} r={r} stroke={color} strokeWidth="1.6" /> : null}
      {category === "in_progress" ? (<><circle cx={c} cy={c} r={r} stroke={color} strokeWidth="1.6" /><path d="M8 4a4 4 0 0 1 0 8z" fill={color} /></>) : null}
      {category === "done" ? (<><circle cx={c} cy={c} r={7} fill={color} /><path d="M5 8.3l2 2 4-4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>) : null}
      {category === "canceled" ? (<><circle cx={c} cy={c} r={7} fill={color} /><path d="M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></>) : null}
    </svg>
  );
}

export function PriorityIcon({ priority, size = 14 }: { priority: Priority | null; size?: number }) {
  const m = priorityMeta(priority);
  if (!m) return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0 text-ink-muted"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".6" /></svg>;
  const bars = 4 - m.rank;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      {[0, 1, 2, 3].map((i) => <rect key={i} x={1.5 + i * 3.8} y={11 - i * 2.8} width="2.6" height={3 + i * 2.8} rx="0.8" fill={i < bars ? m.color : "currentColor"} opacity={i < bars ? 1 : 0.2} />)}
    </svg>
  );
}

const TYPE_ICONS: Record<string, LucideIcon> = { "check-square": CheckSquare, bug: Bug, sparkles: Sparkles, wrench: Wrench, "circle-dot": CircleDot, flag: Flag, bookmark: Bookmark, zap: Zap };
export const TYPE_ICON_NAMES = Object.keys(TYPE_ICONS);
export function TypeIcon({ icon, color, size = 14 }: { icon: string; color: string; size?: number }) {
  const I = TYPE_ICONS[icon] ?? CircleDot;
  return <I size={size} style={{ color }} className="shrink-0" aria-hidden />;
}

export function Avatar({ name, image, size = 20 }: { name: string; image?: string | null; size?: number }) {
  if (image) return <img src={image} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span title={name} className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 45% 48%)` }}>
      {initials(name)}
    </span>
  );
}

export function LabelPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline px-2 py-0.5 text-xs text-ink">
      <span className="size-2 rounded-full" style={{ background: color }} />{name}
    </span>
  );
}

export function ProgressBar({ done, inProgress = 0, total, className = "" }: { done: number; inProgress?: number; total: number; className?: string }) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-paper-grid ${className}`} role="progressbar" aria-valuenow={Math.round(pct(done))} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex h-full">
        <div className="bg-success" style={{ width: `${pct(done)}%` }} />
        <div className="bg-warning/70" style={{ width: `${pct(inProgress)}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {hint ? <div className="max-w-sm text-sm text-ink-muted">{hint}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="p-8 text-sm text-ink-muted">{label}</div>;
}
