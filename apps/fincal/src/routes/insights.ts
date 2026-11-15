import { z } from "zod";
import { sql } from "@twodb/core-data/db";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { scoped } from "../lib/scope.js";
import { num, round2, toApiList } from "../lib/rows.js";
import { addMonths, currentMonth, daysInMonth, isoDay, monthRange, today } from "../lib/dates.js";
import { currentNetWorth, ensureSeeded, upsertSnapshot } from "../lib/finance.js";
import { anyObject, isoDate, month, spaceId } from "./schemas.js";

const rows = async <T = Record<string, any>>(ctx: Ctx, q: ReturnType<typeof sql<T>>) => (await q.execute(ctx.db)).rows;

/** Least-squares line through (0..n-1, ys); returns predictor for index i. */
function trend(ys: number[]): (i: number) => number {
  const n = ys.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => ys[0];
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  ys.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) ** 2; });
  const slope = sxx ? sxy / sxx : 0;
  return (i) => Math.max(0, my + slope * (i - mx));
}

export const insightRoutes: RouteDef[] = [
  route({
    name: "getOverview", method: "GET", path: "/overview",
    description: "Dashboard for a month (default current): income/expense/net, month-end spending projection, budget status, net worth, accounts, credit-card dues, top categories, recent transactions.",
    request: z.object({ spaceId, month: month.optional() }), response: anyObject,
    handler: async (ctx, { spaceId: sid, month: m }) => {
      await ensureSeeded(ctx, sid);
      const mo = m ?? currentMonth();
      const [from, to] = monthRange(mo);
      const prev = monthRange(addMonths(mo, -1));
      const W = sql`workspace_id = ${ctx.workspaceId} and space_id = ${sid}`;
      const [tot] = await rows<any>(ctx, sql`select
          coalesce(sum(amount) filter (where kind = 'income' and date >= ${from} and date < ${to}), 0) as income,
          coalesce(sum(amount) filter (where kind = 'expense' and date >= ${from} and date < ${to}), 0) as expense,
          coalesce(sum(amount) filter (where kind = 'income' and date >= ${prev[0]} and date < ${prev[1]}), 0) as p_income,
          coalesce(sum(amount) filter (where kind = 'expense' and date >= ${prev[0]} and date < ${prev[1]}), 0) as p_expense
        from txn where ${W}`);
      const topCats = await rows<any>(ctx, sql`select c.id, coalesce(c.name, 'Uncategorized') as name, coalesce(c.color, '#9ca3af') as color, sum(t.amount) as amount
        from txn t left join category c on c.id = t.category_id
        where t.workspace_id = ${ctx.workspaceId} and t.space_id = ${sid} and t.kind = 'expense' and t.date >= ${from} and t.date < ${to}
        group by c.id, c.name, c.color order by amount desc limit 6`);
      const [bud] = await rows<any>(ctx, sql`select coalesce(sum(b.amount), 0) as budget,
          coalesce(sum((select coalesce(sum(t.amount), 0) from txn t where t.category_id = b.category_id and t.kind = 'expense' and t.date >= ${from} and t.date < ${to})), 0) as spent,
          count(*) as n
        from budget b where b.workspace_id = ${ctx.workspaceId} and b.space_id = ${sid}`);
      const recent = await scoped(ctx.db.selectFrom("txn")
        .leftJoin("account", "account.id", "txn.account_id").leftJoin("category", "category.id", "txn.category_id")
        .selectAll("txn").select(["account.name as account_name", "category.name as category_name", "category.color as category_color"]), ctx, sid, "txn")
        .orderBy("txn.date", "desc").orderBy("txn.created_at", "desc").limit(8).execute();

      const nw = await currentNetWorth(ctx, sid);
      await upsertSnapshot(ctx, sid, nw.summary);

      const income = num(tot.income), expense = num(tot.expense);
      const isCurrent = mo === currentMonth();
      const dayOfMonth = isCurrent ? Number(today().slice(8, 10)) : daysInMonth(mo);
      const projectedExpense = isCurrent ? round2((expense / Math.max(1, dayOfMonth)) * daysInMonth(mo)) : expense;
      const cards = nw.accounts.filter((a: any) => a.type === "credit_card").map((a: any) => ({ id: a.id, name: a.name, due: a.due, limit: a.creditLimit, utilizationPct: a.utilizationPct, dueDay: a.dueDay, statementDay: a.statementDay }));
      const budget = num(bud.budget), budSpent = num(bud.spent);
      return {
        month: mo,
        income: round2(income), expense: round2(expense), net: round2(income - expense),
        savingsRate: income > 0 ? round2(((income - expense) / income) * 100) : null,
        previous: { income: num(tot.p_income), expense: num(tot.p_expense) },
        projectedExpense, dayOfMonth, daysInMonth: daysInMonth(mo),
        budget: { amount: round2(budget), spent: round2(budSpent), count: Number(bud.n), pct: budget > 0 ? round2((budSpent / budget) * 100) : null },
        netWorth: nw.summary,
        accounts: nw.accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance, color: a.color })),
        cards,
        topCategories: topCats.map((c) => ({ id: c.id, name: c.name, color: c.color, amount: num(c.amount), pct: expense > 0 ? round2((num(c.amount) / expense) * 100) : 0 })),
        recent: toApiList(recent),
      };
    },
  }),
  route({
    name: "getAnalytics", method: "GET", path: "/analytics",
    description: "Spending analytics over a range (default last 12 months): monthly income/expense/savings, category breakdown and trend, payment-method and account split, top payees, weekday pattern, recurring payees, and a 3-month forecast from the completed-month trend.",
    request: z.object({ spaceId, from: isoDate.optional(), to: isoDate.optional() }), response: anyObject,
    handler: async (ctx, { spaceId: sid, from: f, to: t }) => {
      const to = t ?? today();
      const from = f ?? `${addMonths(to.slice(0, 7), -11)}-01`;
      const W = sql`t.workspace_id = ${ctx.workspaceId} and t.space_id = ${sid} and t.date >= ${from} and t.date <= ${to}`;

      const monthlyRows = await rows<any>(ctx, sql`select to_char(t.date, 'YYYY-MM') as m,
          coalesce(sum(t.amount) filter (where t.kind = 'income'), 0) as income, coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0) as expense
        from txn t where ${W} group by 1`);
      const byMonth = new Map(monthlyRows.map((r) => [r.m, r]));
      const months: string[] = [];
      for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) months.push(m);
      const monthly = months.map((m) => {
        const r = byMonth.get(m), income = num(r?.income), expense = num(r?.expense);
        return { month: m, income: round2(income), expense: round2(expense), net: round2(income - expense), savingsRate: income > 0 ? round2(((income - expense) / income) * 100) : null };
      });

      const cat = (kind: string) => rows<any>(ctx, sql`select c.id, coalesce(c.name, 'Uncategorized') as name, coalesce(c.color, '#9ca3af') as color, sum(t.amount) as amount, count(*) as n
        from txn t left join category c on c.id = t.category_id where ${W} and t.kind = ${kind} group by c.id, c.name, c.color order by amount desc`);
      const [expCats, incCats] = await Promise.all([cat("expense"), cat("income")]);
      const totalExpense = monthly.reduce((s, x) => s + x.expense, 0), totalIncome = monthly.reduce((s, x) => s + x.income, 0);
      const withPct = (xs: any[], total: number) => xs.map((c) => ({ id: c.id, name: c.name, color: c.color, amount: num(c.amount), count: Number(c.n), pct: total > 0 ? round2((num(c.amount) / total) * 100) : 0 }));

      const top = expCats.slice(0, 6);
      const catMonthly = top.length ? await rows<any>(ctx, sql`select c.id, to_char(t.date, 'YYYY-MM') as m, sum(t.amount) as amount
        from txn t join category c on c.id = t.category_id where ${W} and t.kind = 'expense' group by c.id, 2`) : [];
      const categoryTrend = top.filter((c) => c.id).map((c) => ({
        categoryId: c.id, name: c.name, color: c.color,
        values: months.map((m) => num(catMonthly.find((r) => r.id === c.id && r.m === m)?.amount)),
      }));

      const [byMethod, byAccount, payees, weekday, recurring, biggest] = await Promise.all([
        rows<any>(ctx, sql`select coalesce(t.method, 'unspecified') as k, sum(t.amount) as amount from txn t where ${W} and t.kind = 'expense' group by 1 order by 2 desc`),
        rows<any>(ctx, sql`select a.name as k, a.type, a.color, sum(t.amount) as amount from txn t join account a on a.id = t.account_id where ${W} and t.kind = 'expense' group by a.name, a.type, a.color order by 4 desc`),
        rows<any>(ctx, sql`select t.payee as k, sum(t.amount) as amount, count(*) as n from txn t where ${W} and t.kind = 'expense' and t.payee is not null group by 1 order by 2 desc limit 10`),
        rows<any>(ctx, sql`select extract(dow from t.date)::int as d, sum(t.amount) as amount, count(*) as n from txn t where ${W} and t.kind = 'expense' group by 1 order by 1`),
        rows<any>(ctx, sql`select t.payee, count(distinct to_char(t.date, 'YYYY-MM')) as months, avg(t.amount) as avg_amount, max(t.date) as last_date
          from txn t where ${W} and t.kind = 'expense' and t.payee is not null group by t.payee
          having count(distinct to_char(t.date, 'YYYY-MM')) >= 3 and coalesce(stddev_pop(t.amount) / nullif(avg(t.amount), 0), 0) < 0.35 order by avg(t.amount) desc limit 15`),
        rows<any>(ctx, sql`select t.amount, t.date, t.payee, c.name as category from txn t left join category c on c.id = t.category_id where ${W} and t.kind = 'expense' order by t.amount desc limit 5`),
      ]);

      // Forecast: linear trend over up to the last 6 completed months.
      const cur = currentMonth();
      const done = monthly.filter((x) => x.month < cur).slice(-6);
      const forecast: { month: string; income: number; expense: number; net: number }[] = [];
      if (done.length >= 2) {
        const fe = trend(done.map((x) => x.expense)), fi = trend(done.map((x) => x.income));
        const startMonth = done[done.length - 1].month;
        for (let k = 1; k <= 3; k++) {
          const e = round2(fe(done.length - 1 + k)), i = round2(fi(done.length - 1 + k));
          forecast.push({ month: addMonths(startMonth, k), income: i, expense: e, net: round2(i - e) });
        }
      }
      const n = Math.max(1, monthly.length);
      return {
        from, to, monthly,
        stats: {
          totalIncome: round2(totalIncome), totalExpense: round2(totalExpense), net: round2(totalIncome - totalExpense),
          avgMonthlyIncome: round2(totalIncome / n), avgMonthlyExpense: round2(totalExpense / n),
          savingsRate: totalIncome > 0 ? round2(((totalIncome - totalExpense) / totalIncome) * 100) : null,
          avgDailyExpense: round2(totalExpense / Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1)),
        },
        expenseByCategory: withPct(expCats, totalExpense), incomeByCategory: withPct(incCats, totalIncome), categoryTrend,
        byMethod: byMethod.map((r) => ({ method: r.k, amount: num(r.amount) })),
        byAccount: byAccount.map((r) => ({ name: r.k, type: r.type, color: r.color, amount: num(r.amount) })),
        topPayees: payees.map((r) => ({ payee: r.k, amount: num(r.amount), count: Number(r.n) })),
        byWeekday: Array.from({ length: 7 }, (_, d) => ({ day: d, amount: num(weekday.find((r) => r.d === d)?.amount), count: Number(weekday.find((r) => r.d === d)?.n ?? 0) })),
        recurring: recurring.map((r) => ({ payee: r.payee, months: Number(r.months), avgAmount: round2(num(r.avg_amount)), lastDate: r.last_date instanceof Date ? isoDay(r.last_date) : r.last_date })),
        biggest: biggest.map((r) => ({ amount: num(r.amount), date: r.date instanceof Date ? isoDay(r.date) : r.date, payee: r.payee, category: r.category })),
        forecast,
      };
    },
  }),
];
