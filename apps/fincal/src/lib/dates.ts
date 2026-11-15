const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDay(new Date());
export const currentMonth = () => today().slice(0, 7);
/** [start, endExclusive) ISO dates for a YYYY-MM month. */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  return [`${month}-01`, `${next}-01`];
}
export const addMonths = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};
export const daysInMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(y, m, 0).getDate(); };
