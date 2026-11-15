import { z } from "zod";
import { sql } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { crud } from "../lib/crud.js";
import { getByIdInWorkspace, scoped } from "../lib/scope.js";
import { num, round2, toApi, toApiList } from "../lib/rows.js";
import { badRequest } from "../lib/http.js";
import { addMonths, currentMonth, today } from "../lib/dates.js";
import { assetGroup, currentNetWorth, loadHoldings, summarize, upsertSnapshot } from "../lib/finance.js";
import { projectRetirement, type RetirementInput } from "../lib/retirement.js";
import { anyList, anyObject, holdingShape, isoDate, liabilityShape, money, ok, positive, spaceId } from "./schemas.js";

// ── holdings: stocks, funds, metals, FDs, RDs, retirement funds … ───────────
const holdingRoutes: RouteDef[] = [
  route({
    name: "listHoldings", method: "GET", path: "/holdings",
    description: "Investments with computed invested / value / gain. FDs and RDs are valued from their terms (principal, rate, compounding, dates) and show maturity value; stocks/funds/metals use quantity × current price; PPF/EPF/NPS/real-estate use the manual current value.",
    request: z.object({ spaceId, assetClass: z.string().optional(), includeArchived: z.coerce.boolean().optional() }),
    response: z.object({ items: anyList, summary: anyObject }),
    handler: async (ctx, { spaceId: sid, assetClass, includeArchived }) => {
      const all = await loadHoldings(ctx, sid, includeArchived);
      const items = assetClass ? all.filter((h: any) => h.assetClass === assetClass) : all;
      const sum = (xs: any[], k: string) => round2(xs.reduce((s, x) => s + x[k], 0));
      const byClass = new Map<string, any[]>();
      for (const h of all) byClass.set(h.assetClass, [...(byClass.get(h.assetClass) ?? []), h]);
      const invested = sum(all, "invested"), value = sum(all, "value");
      return {
        items,
        summary: {
          invested, value, gain: round2(value - invested), gainPct: invested > 0 ? round2(((value - invested) / invested) * 100) : 0,
          byClass: [...byClass].map(([cls, xs]) => ({ assetClass: cls, group: assetGroup(cls), count: xs.length, invested: sum(xs, "invested"), value: sum(xs, "value") })),
        },
      };
    },
  }),
  ...crud({ singular: "Holding", plural: "Holdings", table: "holding", path: "/holdings", shape: holdingShape, createdBy: true, archivable: true, noList: true, describe: "holdings" }),
  route({
    name: "updateHoldingPrices", method: "POST", path: "/holdings/prices",
    description: "Bulk-updates current prices / NAVs (e.g. after copying quotes). Items: [{id, price}].",
    request: z.object({ spaceId, prices: z.array(z.object({ id: z.string(), price: money.pipe(z.number().min(0)) })).min(1).max(500) }), response: z.object({ updated: z.number() }),
    handler: async (ctx, { spaceId: sid, prices }) => {
      let updated = 0;
      for (const p of prices) {
        const r = await scoped(ctx.db.updateTable("holding").set({ current_price: p.price, price_updated_at: new Date() }), ctx, sid).where("id", "=", p.id).executeTakeFirst();
        updated += Number(r.numUpdatedRows ?? 0);
      }
      return { updated };
    },
  }),
  route({
    name: "tradeHolding", method: "POST", path: "/holdings/:id/trade",
    description: "Records a buy (weighted-average cost updates) or sell on a quantity-based holding (stock, fund, metal, crypto…). Also sets the current price to the trade price.",
    request: z.object({ id: z.string(), side: z.enum(["buy", "sell"]), quantity: positive, price: money.pipe(z.number().min(0)), fees: money.pipe(z.number().min(0)).optional(), date: isoDate.optional() }), response: anyObject,
    handler: async (ctx, { id, side, quantity, price, fees, date }) => {
      const h = await getByIdInWorkspace(ctx, "holding", id);
      const q = num(h.quantity), avg = num(h.avg_cost), f = fees ?? 0;
      let newQty = q, newAvg = avg;
      if (side === "buy") { newQty = q + quantity; newAvg = (q * avg + quantity * price + f) / newQty; }
      else { if (quantity > q + 1e-9) throw badRequest(`cannot sell ${quantity}; only ${q} held`); newQty = Math.max(0, q - quantity); }
      await ctx.db.insertInto("holding_trade").values({ id: ulid(), workspace_id: ctx.workspaceId, space_id: h.space_id, holding_id: id, side, quantity, price, fees: f, date: date ?? today(), created_by: ctx.userId }).execute();
      const row = await ctx.db.updateTable("holding").set({ quantity: newQty, avg_cost: newAvg, current_price: price, price_updated_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "listHoldingTrades", method: "GET", path: "/holdings/:id/trades",
    description: "Buy/sell history of a holding.", request: z.object({ id: z.string() }), response: anyList,
    handler: async (ctx, { id }) => {
      await getByIdInWorkspace(ctx, "holding", id);
      return toApiList(await ctx.db.selectFrom("holding_trade").selectAll().where("holding_id", "=", id).orderBy("date", "desc").orderBy("created_at", "desc").execute());
    },
  }),
];

// ── liabilities (loans) ────────────────────────────────────────────────────
const liabilityRoutes: RouteDef[] = crud({ singular: "Liability", plural: "Liabilities", table: "liability", path: "/liabilities", shape: liabilityShape, archivable: true, describe: "liabilities (loans)" });

// ── space settings + net worth ─────────────────────────────────────────────
async function loadSettings(ctx: Ctx, sid: string) {
  const row = await scoped(ctx.db.selectFrom("space_setting").selectAll(), ctx, sid).executeTakeFirst();
  return { currency: (row as any)?.currency ?? "INR", networthTarget: row && (row as any).networth_target !== null ? num((row as any).networth_target) : null };
}

const networthRoutes: RouteDef[] = [
  route({
    name: "getSettings", method: "GET", path: "/settings",
    description: "Space settings: currency and net-worth target.", request: z.object({ spaceId }), response: anyObject,
    handler: async (ctx, { spaceId: sid }) => loadSettings(ctx, sid),
  }),
  route({
    name: "updateSettings", method: "PUT", path: "/settings",
    description: "Updates the space's currency (ISO code) and/or net-worth target (null clears).",
    request: z.object({ spaceId, currency: z.string().length(3).toUpperCase().optional(), networthTarget: money.nullable().optional() }), response: anyObject,
    handler: async (ctx, { spaceId: sid, currency, networthTarget }) => {
      const cur = await loadSettings(ctx, sid);
      const next = { currency: currency ?? cur.currency, target: networthTarget === undefined ? cur.networthTarget : networthTarget };
      await sql`insert into space_setting (space_id, workspace_id, currency, networth_target) values (${sid}, ${ctx.workspaceId}, ${next.currency}, ${next.target})
        on conflict (space_id) do update set currency = excluded.currency, networth_target = excluded.networth_target, updated_at = now()`.execute(ctx.db);
      return loadSettings(ctx, sid);
    },
  }),
  route({
    name: "getNetWorth", method: "GET", path: "/networth",
    description: "Net worth now (assets − liabilities, with breakdown), saved daily snapshots (history), 12-month net-cash trend rebuilt from transactions, and progress toward the target.",
    request: z.object({ spaceId }), response: anyObject,
    handler: async (ctx, { spaceId: sid }) => {
      const { summary, accounts, holdings, liabilities } = await currentNetWorth(ctx, sid);
      await upsertSnapshot(ctx, sid, summary);
      const settings = await loadSettings(ctx, sid);
      const history = toApiList(await scoped(ctx.db.selectFrom("networth_snapshot").selectAll(), ctx, sid).orderBy("date").limit(1000).execute());

      // Net cash position (all counted accounts, cards negative) at each of the last 12 month-ends.
      const open = await sql<{ s: string }>`select coalesce(sum(opening_balance),0) as s from account where workspace_id = ${ctx.workspaceId} and space_id = ${sid} and include_in_networth and archived_at is null`.execute(ctx.db);
      const monthly = await sql<{ m: string; d: string }>`
        select to_char(t.date, 'YYYY-MM') as m, sum(case t.kind when 'income' then t.amount when 'expense' then -t.amount else 0 end) as d
          from txn t join account a on a.id = t.account_id
         where t.workspace_id = ${ctx.workspaceId} and t.space_id = ${sid} and a.include_in_networth and a.archived_at is null
         group by 1 order by 1`.execute(ctx.db);
      const net = new Map(monthly.rows.map((r) => [r.m, num(r.d)]));
      let running = num(open.rows[0]?.s);
      const first = monthly.rows[0]?.m;
      const cashHistory: { month: string; balance: number }[] = [];
      if (first) {
        for (let m = first; m <= currentMonth(); m = addMonths(m, 1)) {
          running += net.get(m) ?? 0;
          cashHistory.push({ month: m, balance: round2(running) });
        }
      }
      const target = settings.networthTarget;
      return {
        ...summary, currency: settings.currency, target,
        progressPct: target && target > 0 ? round2(Math.max(0, Math.min(100, (summary.netWorth / target) * 100))) : null,
        accounts: accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type, balance: a.balance, includeInNetworth: a.includeInNetworth })),
        loansList: liabilities.map((l: any) => ({ id: l.id, name: l.name, outstanding: l.outstanding })),
        holdingsCount: holdings.length,
        history, cashHistory: cashHistory.slice(-12),
      };
    },
  }),
  route({
    name: "saveNetWorthSnapshot", method: "POST", path: "/networth/snapshot",
    description: "Stores today's net-worth snapshot (idempotent; one per day).", request: z.object({ spaceId }), response: anyObject,
    handler: async (ctx, { spaceId: sid }) => {
      const { summary } = await currentNetWorth(ctx, sid);
      await upsertSnapshot(ctx, sid, summary);
      return summary;
    },
  }),
];

// ── retirement ─────────────────────────────────────────────────────────────
const planFields = {
  currentAge: z.number().int().min(14).max(100), retirementAge: z.number().int().min(15).max(100), lifeExpectancy: z.number().int().min(16).max(120),
  monthlyExpense: money.pipe(z.number().min(0)), inflation: money.pipe(z.number().min(0).max(30)),
  preReturn: money.pipe(z.number().min(0).max(40)), postReturn: money.pipe(z.number().min(0).max(30)),
  monthlySaving: money.pipe(z.number().min(0)), stepUp: money.pipe(z.number().min(0).max(30)), otherCorpus: money.pipe(z.number().min(0)),
};
const PLAN_DEFAULTS = { currentAge: 30, retirementAge: 60, lifeExpectancy: 85, monthlyExpense: 50000, inflation: 6, preReturn: 11, postReturn: 8, monthlySaving: 20000, stepUp: 5, otherCorpus: 0 };

async function loadPlan(ctx: Ctx, sid: string) {
  const row = await scoped(ctx.db.selectFrom("retirement_plan").selectAll(), ctx, sid).executeTakeFirst();
  return row ? (toApi(row) as typeof PLAN_DEFAULTS & Record<string, any>) : { ...PLAN_DEFAULTS, saved: false };
}

/** Holdings earmarked for retirement (flag) plus PPF/EPF/NPS. */
async function retirementCorpus(ctx: Ctx, sid: string, otherCorpus: number) {
  const holdings = (await loadHoldings(ctx, sid)).filter((h: any) => h.retirement || ["ppf", "epf", "nps"].includes(h.assetClass));
  const invested = holdings.reduce((s: number, h: any) => s + h.value, 0);
  return { holdings: holdings.map((h: any) => ({ id: h.id, name: h.name, assetClass: h.assetClass, value: h.value })), invested: round2(invested), other: otherCorpus, total: round2(invested + otherCorpus) };
}

function validatePlan(p: RetirementInput) {
  if (p.retirementAge <= p.currentAge) throw badRequest("retirement age must be above current age");
  if (p.lifeExpectancy <= p.retirementAge) throw badRequest("life expectancy must be above retirement age");
}

const retirementRoutes: RouteDef[] = [
  route({
    name: "getRetirement", method: "GET", path: "/retirement",
    description: "Saved retirement plan (or defaults), retirement corpus built from flagged holdings (+PPF/EPF/NPS) and the projection: required corpus, projected corpus, shortfall, saving needed, year-by-year series.",
    request: z.object({ spaceId }), response: anyObject,
    handler: async (ctx, { spaceId: sid }) => {
      const plan = await loadPlan(ctx, sid);
      const corpus = await retirementCorpus(ctx, sid, plan.otherCorpus);
      return { plan, corpus, projection: projectRetirement(plan as RetirementInput, corpus.total) };
    },
  }),
  route({
    name: "saveRetirement", method: "PUT", path: "/retirement",
    description: "Saves the retirement plan assumptions (partial update).",
    request: z.object({ spaceId, ...z.object(planFields).partial().shape }), response: anyObject,
    handler: async (ctx, { spaceId: sid, ...patch }) => {
      const next = { ...(await loadPlan(ctx, sid)), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as typeof PLAN_DEFAULTS;
      validatePlan(next as RetirementInput);
      await sql`insert into retirement_plan (space_id, workspace_id, current_age, retirement_age, life_expectancy, monthly_expense, inflation, pre_return, post_return, monthly_saving, step_up, other_corpus)
        values (${sid}, ${ctx.workspaceId}, ${next.currentAge}, ${next.retirementAge}, ${next.lifeExpectancy}, ${next.monthlyExpense}, ${next.inflation}, ${next.preReturn}, ${next.postReturn}, ${next.monthlySaving}, ${next.stepUp}, ${next.otherCorpus})
        on conflict (space_id) do update set current_age = excluded.current_age, retirement_age = excluded.retirement_age, life_expectancy = excluded.life_expectancy,
          monthly_expense = excluded.monthly_expense, inflation = excluded.inflation, pre_return = excluded.pre_return, post_return = excluded.post_return,
          monthly_saving = excluded.monthly_saving, step_up = excluded.step_up, other_corpus = excluded.other_corpus, updated_at = now()`.execute(ctx.db);
      const plan = await loadPlan(ctx, sid);
      const corpus = await retirementCorpus(ctx, sid, plan.otherCorpus);
      return { plan, corpus, projection: projectRetirement(plan as RetirementInput, corpus.total) };
    },
  }),
  route({
    name: "projectRetirement", method: "POST", path: "/retirement/project",
    description: "What-if projection with overridden assumptions; nothing is saved.",
    request: z.object({ spaceId, ...z.object(planFields).partial().shape }), response: anyObject,
    handler: async (ctx, { spaceId: sid, ...over }) => {
      const plan = { ...(await loadPlan(ctx, sid)), ...Object.fromEntries(Object.entries(over).filter(([, v]) => v !== undefined)) } as typeof PLAN_DEFAULTS;
      validatePlan(plan as RetirementInput);
      const corpus = await retirementCorpus(ctx, sid, plan.otherCorpus);
      return { plan, corpus, projection: projectRetirement(plan as RetirementInput, corpus.total) };
    },
  }),
];

export const wealthRoutes: RouteDef[] = [...holdingRoutes, ...liabilityRoutes, ...networthRoutes, ...retirementRoutes];
