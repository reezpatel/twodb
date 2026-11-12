import type { Field, OptionColor, SelectOption } from "@shared/model";

/** Option colors → soft tinted pill backgrounds (text stays ink, per THEME: no text on zone fills). */
export const OPTION_BG: Record<OptionColor, string> = {
  gray: "color-mix(in oklab, var(--ink) 9%, transparent)",
  brown: "color-mix(in oklab, #9b6b43 22%, transparent)",
  orange: "color-mix(in oklab, var(--materials) 50%, transparent)",
  yellow: "color-mix(in oklab, var(--glow) 55%, transparent)",
  green: "color-mix(in oklab, var(--tritium) 55%, transparent)",
  blue: "color-mix(in oklab, var(--ion) 55%, transparent)",
  purple: "color-mix(in oklab, #a78bda 35%, transparent)",
  pink: "color-mix(in oklab, var(--transmute) 55%, transparent)",
  red: "color-mix(in oklab, var(--pin) 25%, transparent)",
};

export const OPTION_DOT: Record<OptionColor, string> = {
  gray: "var(--ink-muted)",
  brown: "#9b6b43",
  orange: "var(--materials)",
  yellow: "var(--glow)",
  green: "var(--tritium)",
  blue: "var(--ion-deep)",
  purple: "#8b6fd0",
  pink: "var(--transmute)",
  red: "var(--pin)",
};

export const optionOf = (f: Field, id: unknown): SelectOption | undefined => f.config.options?.find((o) => o.id === id);

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function formatDate(iso: unknown, withTime = false): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (withTime ? dateTimeFmt : dateFmt).format(d);
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(iso);
}

export function formatNumber(v: unknown, f?: Field): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  const fmt = f?.config.number?.format ?? "number";
  if (fmt === "percent") return `${Math.round(v * 100) / 100}%`;
  if (fmt === "integer") return Math.round(v).toLocaleString();
  if (fmt === "currency") return new Intl.NumberFormat(undefined, { style: "currency", currency: f?.config.number?.currency || "USD" }).format(v);
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** Local yyyy-mm-dd for <input type=date> and calendar keys. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const newId = () => crypto.randomUUID();
