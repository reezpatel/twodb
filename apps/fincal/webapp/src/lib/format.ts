/** Money formatting follows the space currency; INR gets lakh/crore grouping (en-IN). */
const localeFor = (currency: string) => (currency === "INR" ? "en-IN" : undefined);

export function makeFormatters(currency: string) {
  const locale = localeFor(currency);
  const full = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  const precise = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  return {
    money: (n: number | null | undefined) => (n === null || n === undefined ? "—" : full.format(n)),
    precise: (n: number | null | undefined) => (n === null || n === undefined ? "—" : precise.format(n)),
    compact: (n: number | null | undefined) => (n === null || n === undefined ? "—" : compact.format(n)),
  };
}
export type Formatters = ReturnType<typeof makeFormatters>;

export const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "—" : `${n.toFixed(digits)}%`);
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const thisMonth = () => todayIso().slice(0, 7);
export const addMonths = (m: string, delta: number) => { const [y, mo] = m.split("-").map(Number); const t = y * 12 + (mo - 1) + delta; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (m: string, withYear = false) => { const [y, mo] = m.split("-").map(Number); return `${MONTHS[mo - 1]}${withYear ? ` ${y}` : ""}`; };
export const monthLong = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" }); };
export const dateLabel = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: y === new Date().getFullYear() ? undefined : "numeric" }); };
export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
