/** Pure calculators. Each is declarative (fields + run) so one generic page renders all of them. Retirement lives on its own page (server-side projection). */
export type StatKind = "money" | "pct" | "text" | "num";
export interface Stat { label: string; value: number | string; kind: StatKind; tone?: "good" | "bad" }
export interface Series { name: string; color: string; values: number[] }
export interface CalcResult { stats: Stat[]; chart?: { labels: string[]; series: Series[]; title: string }; note?: string }
export interface Field { key: string; label: string; value: number; suffix?: string; step?: number; min?: number }
export interface Calculator { id: string; title: string; blurb: string; fields: Field[]; run: (v: Record<string, number>) => CalcResult }

const yr = (n: number) => `Y${n}`;
const years = (n: number) => Array.from({ length: n }, (_, i) => yr(i + 1));

export function emiOf(P: number, annualRate: number, months: number) {
  const r = annualRate / 1200;
  if (months <= 0) return 0;
  return r === 0 ? P / months : (P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/** Month-by-month amortisation with an optional extra monthly prepayment. */
export function amortize(P: number, annualRate: number, months: number, extra = 0) {
  const r = annualRate / 1200, emi = emiOf(P, annualRate, months);
  let bal = P, interest = 0, m = 0;
  const yearly: number[] = [P];
  while (bal > 0.5 && m < months + 600) {
    const i = bal * r, pay = Math.min(bal + i, emi + extra);
    interest += i; bal = bal + i - pay; m++;
    if (m % 12 === 0) yearly.push(Math.max(0, bal));
    if (pay <= i && extra === 0 && emi <= i) break;
  }
  if (m % 12 !== 0) yearly.push(0);
  return { emi, months: m, interest, total: P + interest, yearly };
}

export function sipFuture(monthly: number, annualRate: number, yearsN: number, stepUp = 0) {
  const r = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  let bal = 0, invested = 0;
  const byYear: { invested: number; value: number }[] = [];
  for (let m = 0; m < yearsN * 12; m++) {
    const inst = monthly * Math.pow(1 + stepUp / 100, Math.floor(m / 12));
    bal = (bal + inst) * (1 + r); invested += inst;
    if ((m + 1) % 12 === 0) byYear.push({ invested, value: bal });
  }
  return { value: bal, invested, byYear };
}

const stat = (label: string, value: number | string, kind: StatKind = "money", tone?: "good" | "bad"): Stat => ({ label, value, kind, tone });

export const CALCULATORS: Calculator[] = [
  {
    id: "emi", title: "Loan EMI", blurb: "EMI, total interest and balance curve; try a monthly prepayment.",
    fields: [{ key: "P", label: "Loan amount", value: 2500000 }, { key: "rate", label: "Interest rate", value: 9, suffix: "% p.a.", step: 0.05 }, { key: "years", label: "Tenure", value: 15, suffix: "years" }, { key: "extra", label: "Extra monthly prepayment", value: 0 }],
    run: ({ P, rate, years: y, extra }) => {
      const base = amortize(P, rate, y * 12), pre = amortize(P, rate, y * 12, extra);
      const stats = [stat("Monthly EMI", Math.round(base.emi)), stat("Total interest", Math.round(base.interest)), stat("Total payment", Math.round(base.total))];
      if (extra > 0) stats.push(stat("Interest saved", Math.round(base.interest - pre.interest), "money", "good"), stat("Months saved", base.months - pre.months, "num", "good"));
      const n = Math.ceil(base.months / 12);
      return { stats, chart: { title: "Outstanding balance", labels: ["Start", ...years(n)], series: [{ name: "No prepayment", color: "#6366f1", values: base.yearly.slice(0, n + 1) }, ...(extra > 0 ? [{ name: "With prepayment", color: "#22c55e", values: Array.from({ length: n + 1 }, (_, i) => pre.yearly[i] ?? 0) }] : [])] } };
    },
  },
  {
    id: "sip", title: "SIP / mutual-fund growth", blurb: "Future value of a monthly SIP, with optional yearly step-up.",
    fields: [{ key: "monthly", label: "Monthly investment", value: 10000 }, { key: "rate", label: "Expected return", value: 12, suffix: "% p.a.", step: 0.1 }, { key: "years", label: "Duration", value: 15, suffix: "years" }, { key: "step", label: "Yearly step-up", value: 0, suffix: "%" }],
    run: ({ monthly, rate, years: y, step }) => {
      const r = sipFuture(monthly, rate, y, step);
      return { stats: [stat("Future value", Math.round(r.value), "money", "good"), stat("Total invested", Math.round(r.invested)), stat("Wealth gained", Math.round(r.value - r.invested)), stat("Multiple", `${(r.value / Math.max(1, r.invested)).toFixed(2)}×`, "text")],
        chart: { title: "Corpus vs invested", labels: years(y), series: [{ name: "Value", color: "#22c55e", values: r.byYear.map((x) => Math.round(x.value)) }, { name: "Invested", color: "#9ca3af", values: r.byYear.map((x) => Math.round(x.invested)) }] } };
    },
  },
  {
    id: "lumpsum", title: "Lumpsum growth", blurb: "What a one-time investment becomes.",
    fields: [{ key: "P", label: "Amount", value: 500000 }, { key: "rate", label: "Expected return", value: 12, suffix: "% p.a.", step: 0.1 }, { key: "years", label: "Duration", value: 10, suffix: "years" }, { key: "infl", label: "Inflation (for real value)", value: 6, suffix: "%" }],
    run: ({ P, rate, years: y, infl }) => {
      const fv = P * Math.pow(1 + rate / 100, y);
      return { stats: [stat("Future value", Math.round(fv), "money", "good"), stat("Gain", Math.round(fv - P)), stat("Value in today's money", Math.round(fv / Math.pow(1 + infl / 100, y)))],
        chart: { title: "Growth", labels: ["Start", ...years(y)], series: [{ name: "Value", color: "#6366f1", values: Array.from({ length: y + 1 }, (_, i) => Math.round(P * Math.pow(1 + rate / 100, i))) }] } };
    },
  },
  {
    id: "fd", title: "Fixed deposit", blurb: "Maturity value with periodic compounding.",
    fields: [{ key: "P", label: "Deposit", value: 100000 }, { key: "rate", label: "Interest rate", value: 7, suffix: "% p.a.", step: 0.05 }, { key: "years", label: "Tenure", value: 5, suffix: "years", step: 0.5 }, { key: "n", label: "Compounding per year", value: 4, suffix: "× (4 = quarterly)" }],
    run: ({ P, rate, years: y, n }) => {
      const mv = P * Math.pow(1 + rate / 100 / n, n * y);
      return { stats: [stat("Maturity value", Math.round(mv), "money", "good"), stat("Interest earned", Math.round(mv - P)), stat("Effective yield", (Math.pow(1 + rate / 100 / n, n) - 1) * 100, "pct")],
        chart: { title: "Growth", labels: ["Start", ...years(Math.ceil(y))], series: [{ name: "Value", color: "#22c55e", values: Array.from({ length: Math.ceil(y) + 1 }, (_, i) => Math.round(P * Math.pow(1 + rate / 100 / n, n * Math.min(i, y)))) }] } };
    },
  },
  {
    id: "rd", title: "Recurring deposit", blurb: "Maturity of a monthly RD (quarterly compounding is the Indian norm).",
    fields: [{ key: "inst", label: "Monthly deposit", value: 5000 }, { key: "rate", label: "Interest rate", value: 6.5, suffix: "% p.a.", step: 0.05 }, { key: "months", label: "Tenure", value: 36, suffix: "months" }, { key: "n", label: "Compounding per year", value: 4 }],
    run: ({ inst, rate, months, n }) => {
      let mv = 0;
      for (let k = 0; k < months; k++) mv += inst * Math.pow(1 + rate / 100 / n, (n * (months - k)) / 12);
      return { stats: [stat("Maturity value", Math.round(mv), "money", "good"), stat("Total deposited", inst * months), stat("Interest earned", Math.round(mv - inst * months))] };
    },
  },
  {
    id: "goal", title: "Goal planner", blurb: "Monthly SIP needed to reach a target by a date (inflation-adjusted).",
    fields: [{ key: "target", label: "Goal amount (today's money)", value: 5000000 }, { key: "years", label: "Years to goal", value: 10 }, { key: "infl", label: "Inflation", value: 6, suffix: "%" }, { key: "rate", label: "Expected return", value: 12, suffix: "% p.a.", step: 0.1 }, { key: "have", label: "Already saved", value: 200000 }],
    run: ({ target, years: y, infl, rate, have }) => {
      const future = target * Math.pow(1 + infl / 100, y), haveFv = have * Math.pow(1 + rate / 100, y);
      const per = sipFuture(1, rate, y).value, need = Math.max(0, (future - haveFv) / per);
      return { stats: [stat("Goal in future money", Math.round(future)), stat("Monthly SIP needed", Math.round(need), "money", "good"), stat("Existing savings grow to", Math.round(haveFv)), stat("Total you'll invest", Math.round(need * y * 12))] };
    },
  },
  {
    id: "swp", title: "SWP / withdrawal", blurb: "How long a corpus lasts with monthly withdrawals.",
    fields: [{ key: "corpus", label: "Corpus", value: 10000000 }, { key: "wd", label: "Monthly withdrawal", value: 60000 }, { key: "rate", label: "Return", value: 8, suffix: "% p.a.", step: 0.1 }, { key: "infl", label: "Yearly withdrawal increase", value: 5, suffix: "%" }],
    run: ({ corpus, wd, rate, infl }) => {
      const r = Math.pow(1 + rate / 100, 1 / 12) - 1;
      let bal = corpus, m = 0;
      const vals: number[] = [corpus];
      while (bal > 0 && m < 12 * 60) {
        bal = bal * (1 + r) - wd * Math.pow(1 + infl / 100, Math.floor(m / 12)); m++;
        if (m % 12 === 0) vals.push(Math.max(0, Math.round(bal)));
      }
      const lasts = m >= 720;
      if (m % 12 !== 0) vals.push(0);
      return { stats: [stat("Lasts", lasts ? "60+ years" : `${Math.floor(m / 12)}y ${m % 12}m`, "text", lasts ? "good" : "bad"), stat("Initial withdrawal rate", ((wd * 12) / corpus) * 100, "pct")],
        chart: { title: "Remaining corpus", labels: ["Start", ...years(vals.length - 1)], series: [{ name: "Balance", color: "#6366f1", values: vals }] } };
    },
  },
  {
    id: "fire", title: "FIRE number", blurb: "Corpus needed to retire on a safe withdrawal rate.",
    fields: [{ key: "exp", label: "Monthly expenses (today)", value: 60000 }, { key: "swr", label: "Safe withdrawal rate", value: 3.5, suffix: "%", step: 0.1 }, { key: "years", label: "Years until retirement", value: 20 }, { key: "infl", label: "Inflation", value: 6, suffix: "%" }],
    run: ({ exp, swr, years: y, infl }) => {
      const today = (exp * 12) / (swr / 100), future = (exp * 12 * Math.pow(1 + infl / 100, y)) / (swr / 100);
      return { stats: [stat("FIRE number (today)", Math.round(today)), stat("FIRE number at retirement", Math.round(future), "money", "good"), stat("Multiple of annual spend", `${(100 / swr).toFixed(1)}×`, "text")] };
    },
  },
  {
    id: "cagr", title: "CAGR / returns", blurb: "Annualised return between two values.",
    fields: [{ key: "start", label: "Start value", value: 100000 }, { key: "end", label: "End value", value: 250000 }, { key: "years", label: "Years", value: 6, step: 0.5 }],
    run: ({ start, end, years: y }) => ({ stats: [stat("CAGR", (Math.pow(end / start, 1 / y) - 1) * 100, "pct", end >= start ? "good" : "bad"), stat("Absolute return", ((end - start) / start) * 100, "pct"), stat("Gain", Math.round(end - start))] }),
  },
  {
    id: "inflation", title: "Inflation impact", blurb: "What things will cost — and what money will be worth.",
    fields: [{ key: "amt", label: "Amount today", value: 100000 }, { key: "rate", label: "Inflation", value: 6, suffix: "% p.a.", step: 0.1 }, { key: "years", label: "Years", value: 20 }],
    run: ({ amt, rate, years: y }) => ({ stats: [stat("Same things will cost", Math.round(amt * Math.pow(1 + rate / 100, y))), stat("Today's money will buy only", Math.round(amt / Math.pow(1 + rate / 100, y)))],
      chart: { title: "Cost of today's basket", labels: ["Now", ...years(y)], series: [{ name: "Cost", color: "#ef4444", values: Array.from({ length: y + 1 }, (_, i) => Math.round(amt * Math.pow(1 + rate / 100, i))) }] } }),
  },
  {
    id: "ccpayoff", title: "Credit-card payoff", blurb: "Months & interest to clear a card balance with a fixed payment.",
    fields: [{ key: "bal", label: "Outstanding balance", value: 100000 }, { key: "apr", label: "APR", value: 42, suffix: "% p.a.", step: 0.5 }, { key: "pay", label: "Monthly payment", value: 8000 }],
    run: ({ bal, apr, pay }) => {
      const r = apr / 1200;
      if (pay <= bal * r) return { stats: [stat("Result", "Payment doesn't cover the monthly interest", "text", "bad")], note: `Interest alone is about ${Math.round(bal * r)} a month.` };
      let b = bal, m = 0, int = 0;
      while (b > 0.5 && m < 1200) { const i = b * r; int += i; b = b + i - Math.min(b + i, pay); m++; }
      return { stats: [stat("Time to clear", `${Math.floor(m / 12)}y ${m % 12}m`, "text"), stat("Total interest", Math.round(int), "money", "bad"), stat("Total paid", Math.round(bal + int))] };
    },
  },
  {
    id: "ppf", title: "PPF", blurb: "15-year PPF maturity (extendable in 5-year blocks).",
    fields: [{ key: "yearly", label: "Yearly deposit (max 1,50,000)", value: 150000 }, { key: "rate", label: "Rate", value: 7.1, suffix: "% p.a.", step: 0.1 }, { key: "years", label: "Years", value: 15 }],
    run: ({ yearly, rate, years: y }) => {
      let bal = 0; const vals: number[] = [];
      for (let i = 0; i < y; i++) { bal = (bal + Math.min(yearly, 150000)) * (1 + rate / 100); vals.push(Math.round(bal)); }
      const inv = Math.min(yearly, 150000) * y;
      return { stats: [stat("Maturity value", Math.round(bal), "money", "good"), stat("Invested", inv), stat("Interest (tax-free)", Math.round(bal - inv))], chart: { title: "Balance", labels: years(y), series: [{ name: "PPF", color: "#14b8a6", values: vals }] } };
    },
  },
];
