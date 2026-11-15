export type AccountType = "bank" | "cash" | "upi" | "credit_card" | "wallet" | "other";
export type TxnKind = "expense" | "income" | "transfer";

export interface Account {
  id: string; name: string; type: AccountType; institution: string | null; openingBalance: number; creditLimit: number | null;
  statementDay: number | null; dueDay: number | null; color: string; includeInNetworth: boolean; archivedAt: string | null;
  balance: number; due?: number; available?: number | null; utilizationPct?: number | null;
}
export interface Category { id: string; name: string; kind: "expense" | "income"; color: string }
export interface Txn {
  id: string; accountId: string; kind: TxnKind; amount: number; date: string; categoryId: string | null; toAccountId: string | null;
  payee: string | null; note: string | null; method: string | null; tags: string[]; envelopeId: string | null;
  accountName?: string; accountType?: string; toAccountName?: string | null; categoryName?: string | null; categoryColor?: string | null; envelopeName?: string | null;
}
export interface TxnList { items: Txn[]; total: number; income: number; expense: number }
export interface BudgetItem { id: string; categoryId: string; categoryName: string; color: string; amount: number; spent: number; remaining: number; pct: number }
export interface Budgets { month: string; items: BudgetItem[]; unbudgeted: { categoryId: string | null; categoryName: string; color: string; spent: number }[]; totals: { budget: number; spent: number; remaining: number; unbudgetedSpent: number } }
export interface Envelope { id: string; name: string; color: string; target: number | null; monthlyFill: number | null; funded: number; spent: number; balance: number; pct: number | null; archivedAt: string | null }
export interface Envelopes { items: Envelope[]; totalBalance: number; unallocated: number }
export interface Goal { id: string; name: string; kind: string; targetAmount: number; targetDate: string | null; color: string; note: string | null; saved: number; pct: number; monthsLeft: number | null; requiredMonthly: number | null }
export interface Holding {
  id: string; assetClass: string; name: string; symbol: string | null; institution: string | null; quantity: number; avgCost: number; currentPrice: number | null;
  principal: number | null; currentValue: number | null; interestRate: number | null; compounding: number; installment: number | null;
  startDate: string | null; maturityDate: string | null; unit: string | null; retirement: boolean; note: string | null; priceUpdatedAt: string | null;
  invested: number; value: number; gain: number; gainPct: number; maturityValue: number | null; daysToMaturity: number | null; progress: number | null;
}
export interface HoldingsResp { items: Holding[]; summary: { invested: number; value: number; gain: number; gainPct: number; byClass: { assetClass: string; group: string; count: number; invested: number; value: number }[] } }
export interface Liability { id: string; name: string; kind: string; principal: number; outstanding: number; interestRate: number | null; emi: number | null; startDate: string | null; endDate: string | null; note: string | null }
export interface NetWorth {
  assets: number; liabilities: number; netWorth: number; cash: number; investments: number; cardDues: number; loans: number; currency: string; target: number | null; progressPct: number | null;
  byGroup: { name: string; value: number }[]; history: { date: string; assets: number; liabilities: number; netWorth: number }[]; cashHistory: { month: string; balance: number }[];
  accounts: { id: string; name: string; type: string; balance: number }[]; loansList: { id: string; name: string; outstanding: number }[];
}
export interface RetirementPlan { currentAge: number; retirementAge: number; lifeExpectancy: number; monthlyExpense: number; inflation: number; preReturn: number; postReturn: number; monthlySaving: number; stepUp: number; otherCorpus: number }
export interface RetirementResp {
  plan: RetirementPlan; corpus: { holdings: { id: string; name: string; assetClass: string; value: number }[]; invested: number; other: number; total: number };
  projection: { yearsToRetire: number; yearsInRetirement: number; monthlyExpenseAtRetirement: number; requiredCorpus: number; projectedCorpus: number; shortfall: number; coveragePct: number; requiredMonthlySaving: number; depletesAtAge: number | null; onTrack: boolean; series: { age: number; balance: number; phase: "saving" | "retired" }[] };
}
export interface Overview {
  month: string; income: number; expense: number; net: number; savingsRate: number | null; previous: { income: number; expense: number };
  projectedExpense: number; dayOfMonth: number; daysInMonth: number; budget: { amount: number; spent: number; count: number; pct: number | null };
  netWorth: { assets: number; liabilities: number; netWorth: number; byGroup: { name: string; value: number }[] };
  accounts: { id: string; name: string; type: string; balance: number; color: string }[];
  cards: { id: string; name: string; due: number; limit: number | null; utilizationPct: number | null; dueDay: number | null; statementDay: number | null }[];
  topCategories: { id: string | null; name: string; color: string; amount: number; pct: number }[]; recent: Txn[];
}
export interface Analytics {
  from: string; to: string;
  monthly: { month: string; income: number; expense: number; net: number; savingsRate: number | null }[];
  stats: { totalIncome: number; totalExpense: number; net: number; avgMonthlyIncome: number; avgMonthlyExpense: number; savingsRate: number | null; avgDailyExpense: number };
  expenseByCategory: { id: string | null; name: string; color: string; amount: number; count: number; pct: number }[];
  incomeByCategory: { id: string | null; name: string; color: string; amount: number; count: number; pct: number }[];
  categoryTrend: { categoryId: string; name: string; color: string; values: number[] }[];
  byMethod: { method: string; amount: number }[]; byAccount: { name: string; type: string; color: string; amount: number }[];
  topPayees: { payee: string; amount: number; count: number }[]; byWeekday: { day: number; amount: number; count: number }[];
  recurring: { payee: string; months: number; avgAmount: number; lastDate: string }[];
  biggest: { amount: number; date: string; payee: string | null; category: string | null }[];
  forecast: { month: string; income: number; expense: number; net: number }[];
}
