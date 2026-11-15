export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  monthlyExpense: number;
  inflation: number;
  preReturn: number;
  postReturn: number;
  monthlySaving: number;
  stepUp: number;
}

export interface RetirementProjection {
  yearsToRetire: number;
  yearsInRetirement: number;
  monthlyExpenseAtRetirement: number;
  requiredCorpus: number;
  projectedCorpus: number;
  shortfall: number;
  coveragePct: number;
  requiredMonthlySaving: number;
  /** Age at which money runs out in retirement; null = lasts past life expectancy. */
  depletesAtAge: number | null;
  onTrack: boolean;
  series: { age: number; balance: number; phase: "saving" | "retired" }[];
}

const mrate = (pct: number) => Math.pow(1 + pct / 100, 1 / 12) - 1;

/** Corpus after `months` of monthly saving (stepped up yearly) on top of an opening balance. */
function accumulate(opening: number, saving: number, stepUpPct: number, preReturn: number, months: number) {
  const r = mrate(preReturn);
  let bal = opening;
  for (let m = 0; m < months; m++) bal = bal * (1 + r) + saving * Math.pow(1 + stepUpPct / 100, Math.floor(m / 12));
  return bal;
}

export function projectRetirement(p: RetirementInput, openingCorpus: number): RetirementProjection {
  const yearsToRetire = Math.max(0, p.retirementAge - p.currentAge);
  const yearsInRetirement = Math.max(0, p.lifeExpectancy - p.retirementAge);
  const infl = p.inflation / 100, post = p.postReturn / 100;
  const annualAtRet = p.monthlyExpense * 12 * Math.pow(1 + infl, yearsToRetire);

  // Corpus needed at retirement: PV of inflation-growing withdrawals taken at the start of each year.
  let required = 0;
  for (let i = 0; i < yearsInRetirement; i++) required += (annualAtRet * Math.pow(1 + infl, i)) / Math.pow(1 + post, i);

  const months = yearsToRetire * 12;
  const projected = accumulate(openingCorpus, p.monthlySaving, p.stepUp, p.preReturn, months);
  // corpus is linear in the saving amount: solve for the saving that exactly reaches `required`.
  const base = accumulate(openingCorpus, 0, p.stepUp, p.preReturn, months);
  const perUnit = accumulate(0, 1, p.stepUp, p.preReturn, months);
  const requiredMonthlySaving = perUnit > 0 ? Math.max(0, (required - base) / perUnit) : 0;

  const series: RetirementProjection["series"] = [];
  const r = mrate(p.preReturn);
  let bal = openingCorpus;
  for (let y = 0; y <= yearsToRetire; y++) {
    series.push({ age: p.currentAge + y, balance: Math.round(bal), phase: "saving" });
    if (y === yearsToRetire) break;
    for (let m = 0; m < 12; m++) bal = bal * (1 + r) + p.monthlySaving * Math.pow(1 + p.stepUp / 100, y);
  }
  let depletes: number | null = null;
  let rb = bal;
  for (let i = 0; i < yearsInRetirement; i++) {
    rb = (rb - annualAtRet * Math.pow(1 + infl, i)) * (1 + post);
    const age = p.retirementAge + i + 1;
    if (rb < 0 && depletes === null) { depletes = age - 1; rb = 0; }
    series.push({ age, balance: Math.round(Math.max(0, rb)), phase: "retired" });
  }
  return {
    yearsToRetire, yearsInRetirement,
    monthlyExpenseAtRetirement: Math.round(annualAtRet / 12),
    requiredCorpus: Math.round(required), projectedCorpus: Math.round(projected),
    shortfall: Math.round(Math.max(0, required - projected)),
    coveragePct: required > 0 ? Math.round((projected / required) * 1000) / 10 : 100,
    requiredMonthlySaving: Math.round(requiredMonthlySaving),
    depletesAtAge: depletes, onTrack: projected >= required, series,
  };
}
