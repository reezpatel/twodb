export function formatQty(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: n < 1 && n > 0 ? 3 : 2 });
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
export function timeAgo(iso: string): string {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString();
}

/** Short relative time: "now", "3m ago", "5h ago", "5d ago", "2w ago", "3mo ago", "1y ago". */
export function timeAgoShort(d: Date | string): string {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  if (s < 86400 * 30) return `${Math.round(s / (86400 * 7))}w ago`;
  if (s < 86400 * 365) return `${Math.round(s / (86400 * 30))}mo ago`;
  return `${Math.round(s / (86400 * 365))}y ago`;
}

export const pathText = (path: { name: string }[]) => path.map((c) => c.name).join(" › ");

/** "K7QM2X" → "K7Q-M2X" (other strings unchanged). */
export const displayCode = (code: string) => (/^[0-9A-Z]{6}$/.test(code) ? `${code.slice(0, 3)}-${code.slice(3)}` : code);
