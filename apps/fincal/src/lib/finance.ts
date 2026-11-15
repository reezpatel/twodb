import { sql } from "@twodb/core-data/db";
import type { Ctx } from "./route.js";
import { scoped } from "./scope.js";
import { num, round2, toApi } from "./rows.js";
import { valueHolding } from "./valuation.js";

/** Accounts with live balance (opening + income − expense ± transfers). Credit-card balance is negative when money is owed. */
export async function loadAccounts(ctx: Ctx, spaceId: string, includeArchived = false) {
  const res = await sql<Record<string, any>>`
    with moves as (
      select account_id as aid, case kind when 'income' then amount else -amount end as d
        from txn where workspace_id = ${ctx.workspaceId} and space_id = ${spaceId}
      union all
      select to_account_id, amount from txn
        where workspace_id = ${ctx.workspaceId} and space_id = ${spaceId} and kind = 'transfer' and to_account_id is not null
    )
    select a.*, a.opening_balance + coalesce((select sum(d) from moves where aid = a.id), 0) as balance
      from account a
     where a.workspace_id = ${ctx.workspaceId} and a.space_id = ${spaceId} ${includeArchived ? sql`` : sql`and a.archived_at is null`}
     order by a.created_at`.execute(ctx.db);
  return res.rows.map((r) => {
    const balance = round2(num(r.balance));
    const out: Record<string, any> = { ...toApi(r), balance };
    if (r.type === "credit_card") {
      const due = Math.max(0, -balance);
      out.due = round2(due);
      out.available = r.credit_limit === null ? null : round2(num(r.credit_limit) - due);
      out.utilizationPct = r.credit_limit && num(r.credit_limit) > 0 ? round2((due / num(r.credit_limit)) * 100) : null;
    }
    return out;
  });
}

export async function loadHoldings(ctx: Ctx, spaceId: string, includeArchived = false) {
  let q = scoped(ctx.db.selectFrom("holding").selectAll(), ctx, spaceId).orderBy("created_at");
  if (!includeArchived) q = q.where("archived_at", "is", null);
  const rows = await q.execute();
  return rows.map((r: any) => ({ ...toApi(r), ...valueHolding(r) }) as Record<string, any>);
}

export async function loadLiabilities(ctx: Ctx, spaceId: string) {
  const rows = await scoped(ctx.db.selectFrom("liability").selectAll(), ctx, spaceId).where("archived_at", "is", null).orderBy("created_at").execute();
  return rows.map((r: any) => toApi(r));
}

export const assetGroup = (cls: string) =>
  cls === "stock" || cls === "etf" ? "Equity" : cls === "mutual_fund" ? "Mutual funds" : ["gold", "silver", "platinum"].includes(cls) ? "Metals"
  : ["fd", "rd", "bond"].includes(cls) ? "Fixed income" : ["ppf", "epf", "nps"].includes(cls) ? "Retirement funds" : cls === "crypto" ? "Crypto" : cls === "real_estate" ? "Real estate" : "Other";

export interface NetWorth {
  assets: number;
  liabilities: number;
  netWorth: number;
  cash: number;
  investments: number;
  cardDues: number;
  loans: number;
  byGroup: { name: string; value: number }[];
}

/** Net worth from live balances, holding valuations and liabilities. */
export function summarize(accounts: any[], holdings: any[], liabilities: any[]): NetWorth {
  const counted = accounts.filter((a) => a.includeInNetworth);
  const cash = counted.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const cardDues = counted.reduce((s, a) => s + Math.max(0, -a.balance), 0);
  const groups = new Map<string, number>();
  for (const h of holdings) groups.set(assetGroup(h.assetClass), (groups.get(assetGroup(h.assetClass)) ?? 0) + h.value);
  const investments = holdings.reduce((s, h) => s + h.value, 0);
  const loans = liabilities.reduce((s, l) => s + l.outstanding, 0);
  const assets = cash + investments, liab = cardDues + loans;
  return {
    assets: round2(assets), liabilities: round2(liab), netWorth: round2(assets - liab), cash: round2(cash), investments: round2(investments),
    cardDues: round2(cardDues), loans: round2(loans),
    byGroup: [...(cash > 0 ? [{ name: "Cash & bank", value: round2(cash) }] : []), ...[...groups].map(([name, value]) => ({ name, value: round2(value) }))],
  };
}

export async function currentNetWorth(ctx: Ctx, spaceId: string) {
  const [accounts, holdings, liabilities] = await Promise.all([loadAccounts(ctx, spaceId), loadHoldings(ctx, spaceId), loadLiabilities(ctx, spaceId)]);
  return { accounts, holdings, liabilities, summary: summarize(accounts, holdings, liabilities) };
}

/** One snapshot per day, overwritten as the day progresses. */
export async function upsertSnapshot(ctx: Ctx, spaceId: string, s: NetWorth) {
  await sql`
    insert into networth_snapshot (space_id, workspace_id, date, assets, liabilities, net_worth, breakdown)
    values (${spaceId}, ${ctx.workspaceId}, current_date, ${s.assets}, ${s.liabilities}, ${s.netWorth}, ${JSON.stringify({ byGroup: s.byGroup, cash: s.cash, investments: s.investments, cardDues: s.cardDues, loans: s.loans })}::jsonb)
    on conflict (space_id, date) do update set assets = excluded.assets, liabilities = excluded.liabilities, net_worth = excluded.net_worth, breakdown = excluded.breakdown`.execute(ctx.db);
}

export const DEFAULT_CATEGORIES: { name: string; kind: "expense" | "income"; color: string }[] = [
  { name: "Groceries", kind: "expense", color: "#22c55e" }, { name: "Dining out", kind: "expense", color: "#f97316" },
  { name: "Rent & housing", kind: "expense", color: "#6366f1" }, { name: "Utilities & bills", kind: "expense", color: "#0ea5e9" },
  { name: "Transport & fuel", kind: "expense", color: "#eab308" }, { name: "Shopping", kind: "expense", color: "#ec4899" },
  { name: "Health", kind: "expense", color: "#ef4444" }, { name: "Education", kind: "expense", color: "#8b5cf6" },
  { name: "Entertainment", kind: "expense", color: "#14b8a6" }, { name: "Travel", kind: "expense", color: "#06b6d4" },
  { name: "Insurance", kind: "expense", color: "#64748b" }, { name: "EMI & loans", kind: "expense", color: "#b45309" },
  { name: "Subscriptions", kind: "expense", color: "#a855f7" }, { name: "Gifts & donations", kind: "expense", color: "#f43f5e" },
  { name: "Other", kind: "expense", color: "#9ca3af" },
  { name: "Salary", kind: "income", color: "#16a34a" }, { name: "Business", kind: "income", color: "#0d9488" },
  { name: "Interest & dividends", kind: "income", color: "#2563eb" }, { name: "Rental", kind: "income", color: "#7c3aed" },
  { name: "Refunds", kind: "income", color: "#ca8a04" }, { name: "Other income", kind: "income", color: "#9ca3af" },
];

/** First touch of a space seeds the default categories (once; deleting them later never re-seeds). */
export async function ensureSeeded(ctx: Ctx, spaceId: string) {
  const res = await sql<{ seeded: boolean }>`
    insert into space_setting (space_id, workspace_id, seeded) values (${spaceId}, ${ctx.workspaceId}, true)
    on conflict (space_id) do update set seeded = true where space_setting.seeded = false
    returning seeded`.execute(ctx.db);
  if (!res.rows.length) return;
  const { ulid } = await import("ulid");
  await ctx.db.insertInto("category")
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ id: ulid(), workspace_id: ctx.workspaceId, space_id: spaceId, name: c.name, kind: c.kind, color: c.color, position: i })))
    .onConflict((oc: any) => oc.doNothing()).execute();
}
