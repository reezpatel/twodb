export const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => toIsoDate(new Date());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);

const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fmtY = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
export function formatDate(s: string | null | undefined, withYear = false) {
  const d = parseDate(s);
  return d ? (withYear || d.getFullYear() !== new Date().getFullYear() ? fmtY : fmt).format(d) : "";
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  return formatDate(iso.slice(0, 10), true);
}

export function formatMinutes(m: number | null): string {
  if (!m) return "";
  const h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
}
/** "1h 30m", "90m", "2h" -> minutes. */
export function parseMinutes(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  const h = /(\d+(?:\.\d+)?)\s*h/.exec(t), m = /(\d+)\s*m/.exec(t);
  if (h || m) return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}
export const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
