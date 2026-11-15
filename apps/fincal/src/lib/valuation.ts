import { num, round2 } from "./rows.js";

/** Pure valuation of one holding row (snake_case, as stored). FD/RD are computed from their terms. */
export interface Valuation {
  invested: number;
  value: number;
  gain: number;
  gainPct: number;
  /** FD/RD only (needs maturity_date). */
  maturityValue: number | null;
  daysToMaturity: number | null;
  /** Share of the term elapsed, 0..1 (FD/RD). */
  progress: number | null;
}

const MS_DAY = 86_400_000;
const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);

export const PRICED = new Set(["stock", "mutual_fund", "etf", "gold", "silver", "platinum", "bond", "crypto"]);
export const MANUAL = new Set(["ppf", "epf", "nps", "real_estate", "other"]);

export function fdValue(principal: number, ratePct: number, n: number, years: number) {
  return principal * Math.pow(1 + ratePct / 100 / n, n * Math.max(0, years));
}

/** Recurring deposit: one `inst` per month from the start; compounded `n` times a year. */
export function rdValue(inst: number, ratePct: number, n: number, installments: number, elapsedYears: number) {
  let v = 0;
  for (let k = 0; k < installments; k++) v += inst * Math.pow(1 + ratePct / 100 / n, n * Math.max(0, elapsedYears - k / 12));
  return v;
}

export function valueHolding(h: Record<string, any>, today = new Date()): Valuation {
  const cls: string = h.asset_class;
  let invested = 0, value = 0, maturityValue: number | null = null, daysToMaturity: number | null = null, progress: number | null = null;
  const start = toDate(h.start_date), maturity = toDate(h.maturity_date);
  const rate = num(h.interest_rate), n = h.compounding || 4;

  if (cls === "fd") {
    const P = num(h.principal);
    invested = P;
    if (start) {
      const end = maturity && today > maturity ? maturity : today;
      value = fdValue(P, rate, n, (end.getTime() - start.getTime()) / MS_DAY / 365);
    } else value = P;
    if (start && maturity) maturityValue = fdValue(P, rate, n, (maturity.getTime() - start.getTime()) / MS_DAY / 365);
  } else if (cls === "rd") {
    const inst = num(h.installment);
    if (start) {
      const tenure = maturity ? Math.max(1, monthsBetween(start, maturity)) : Infinity;
      const paid = Math.min(Math.max(0, monthsBetween(start, today) + 1), tenure);
      const end = maturity && today > maturity ? maturity : today;
      invested = inst * paid;
      value = rdValue(inst, rate, n, paid, (end.getTime() - start.getTime()) / MS_DAY / 365);
      if (maturity) maturityValue = rdValue(inst, rate, n, tenure, tenure / 12);
    }
  } else if (MANUAL.has(cls)) {
    invested = num(h.principal);
    value = h.current_value !== null && h.current_value !== undefined ? num(h.current_value) : invested;
  } else {
    const qty = num(h.quantity);
    invested = qty * num(h.avg_cost);
    value = qty * (h.current_price !== null && h.current_price !== undefined ? num(h.current_price) : num(h.avg_cost));
  }
  if ((cls === "fd" || cls === "rd") && maturity) {
    daysToMaturity = Math.ceil((maturity.getTime() - today.getTime()) / MS_DAY);
    if (start) progress = Math.min(1, Math.max(0, (today.getTime() - start.getTime()) / (maturity.getTime() - start.getTime())));
  }
  const gain = value - invested;
  return {
    invested: round2(invested), value: round2(value), gain: round2(gain), gainPct: invested > 0 ? round2((gain / invested) * 100) : 0,
    maturityValue: maturityValue === null ? null : round2(maturityValue), daysToMaturity, progress,
  };
}
