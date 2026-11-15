import { z } from "zod";
import { sql } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { crud } from "../lib/crud.js";
import { assertOwned, getByIdInWorkspace, scoped } from "../lib/scope.js";
import { num, round2, snake, toApi, toApiList } from "../lib/rows.js";
import { badRequest } from "../lib/http.js";
import { ensureSeeded, loadAccounts } from "../lib/finance.js";
import { currentMonth, monthRange } from "../lib/dates.js";
import { PAY_METHODS, TXN_KINDS } from "../db/schema.js";
import { accountShape, anyList, anyObject, categoryShape, isoDate, month, ok, positive, spaceId, money } from "./schemas.js";

// ── accounts ───────────────────────────────────────────────────────────────
const accountRoutes: RouteDef[] = [
  route({
    name: "listAccounts", method: "GET", path: "/accounts",
    description: "Accounts of a space with live balance. Credit cards add due / available / utilizationPct (balance is negative when money is owed).",
    request: z.object({ spaceId, includeArchived: z.coerce.boolean().optional() }), response: anyList,
    handler: async (ctx, { spaceId: sid, includeArchived }) => {
      await ensureSeeded(ctx, sid);
      return loadAccounts(ctx, sid, includeArchived);
    },
  }),
  ...crud({ singular: "Account", plural: "Accounts", table: "account", path: "/accounts", shape: accountShape, createdBy: true, archivable: true, noList: true, describe: "accounts" }),
];

// ── categories ─────────────────────────────────────────────────────────────
const categoryRoutes: RouteDef[] = [
  route({
    name: "listCategories", method: "GET", path: "/categories",
    description: "Income/expense categories of a space (default set is seeded on first use).",
    request: z.object({ spaceId, kind: z.enum(["expense", "income"]).optional() }), response: anyList,
    handler: async (ctx, { spaceId: sid, kind }) => {
      await ensureSeeded(ctx, sid);
      let q = scoped(ctx.db.selectFrom("category").selectAll(), ctx, sid).orderBy("kind").orderBy("position").orderBy("name");
      if (kind) q = q.where("kind", "=", kind);
      return toApiList(await q.execute());
    },
  }),
  ...crud({ singular: "Category", plural: "Categories", table: "category", path: "/categories", shape: categoryShape, noList: true, describe: "categories" }),
];

// ── transactions ───────────────────────────────────────────────────────────
const txnShape = {
  accountId: z.string(),
  kind: z.enum(TXN_KINDS),
  amount: positive,
  date: isoDate,
  categoryId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  payee: z.string().max(120).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  method: z.enum(PAY_METHODS).nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(20).optional(),
  envelopeId: z.string().nullable().optional(),
};

async function validateTxn(ctx: Ctx, sid: string, d: Record<string, any>) {
  await assertOwned(ctx, "account", sid, d.accountId, "account");
  await assertOwned(ctx, "account", sid, d.toAccountId, "destination account");
  await assertOwned(ctx, "category", sid, d.categoryId, "category");
  await assertOwned(ctx, "envelope", sid, d.envelopeId, "envelope");
  if (d.kind === "transfer") {
    if (!d.toAccountId) throw badRequest("transfers need a destination account");
    if (d.toAccountId === d.accountId) throw badRequest("source and destination account must differ");
  }
}

const listInput = z.object({
  spaceId,
  from: isoDate.optional(), to: isoDate.optional(),
  accountId: z.string().optional(), categoryId: z.string().optional(), envelopeId: z.string().optional(),
  kind: z.enum(TXN_KINDS).optional(), method: z.enum(PAY_METHODS).optional(), tag: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(), offset: z.coerce.number().int().min(0).optional(),
});

function filtered(ctx: Ctx, f: z.infer<typeof listInput>, q: any) {
  q = scoped(q, ctx, f.spaceId, "txn");
  if (f.from) q = q.where("txn.date", ">=", f.from);
  if (f.to) q = q.where("txn.date", "<=", f.to);
  // an account filter matches both legs of a transfer
  if (f.accountId) q = q.where((eb: any) => eb.or([eb("txn.account_id", "=", f.accountId), eb("txn.to_account_id", "=", f.accountId)]));
  if (f.categoryId) q = q.where("txn.category_id", "=", f.categoryId);
  if (f.envelopeId) q = q.where("txn.envelope_id", "=", f.envelopeId);
  if (f.kind) q = q.where("txn.kind", "=", f.kind);
  if (f.method) q = q.where("txn.method", "=", f.method);
  if (f.tag) q = q.where(sql<boolean>`${f.tag} = any(txn.tags)`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    q = q.where((eb: any) => eb.or([eb("txn.payee", "ilike", like), eb("txn.note", "ilike", like)]));
  }
  return q;
}

const transactionRoutes: RouteDef[] = [
  route({
    name: "listTransactions", method: "GET", path: "/transactions",
    description: "Transactions of a space, newest first, with filters (date range, account, category, envelope, kind, method, tag, text). Returns totals for the filtered set.",
    request: listInput, response: z.object({ items: anyList, total: z.number(), income: z.number(), expense: z.number() }),
    handler: async (ctx, f) => {
      const rows = await filtered(ctx, f, ctx.db.selectFrom("txn")
        .leftJoin("account", "account.id", "txn.account_id").leftJoin("account as to_acc", "to_acc.id", "txn.to_account_id")
        .leftJoin("category", "category.id", "txn.category_id").leftJoin("envelope", "envelope.id", "txn.envelope_id")
        .selectAll("txn")
        .select(["account.name as account_name", "account.type as account_type", "to_acc.name as to_account_name", "category.name as category_name", "category.color as category_color", "envelope.name as envelope_name"]))
        .orderBy("txn.date", "desc").orderBy("txn.created_at", "desc").limit(f.limit ?? 200).offset(f.offset ?? 0).execute();
      const agg = await filtered(ctx, f, ctx.db.selectFrom("txn").select([
        sql<string>`count(*)`.as("n"),
        sql<string>`coalesce(sum(case when txn.kind = 'income' then txn.amount end), 0)`.as("income"),
        sql<string>`coalesce(sum(case when txn.kind = 'expense' then txn.amount end), 0)`.as("expense"),
      ])).executeTakeFirst();
      return { items: toApiList(rows), total: Number(agg?.n ?? 0), income: num(agg?.income), expense: num(agg?.expense) };
    },
  }),
  route({
    name: "createTransaction", method: "POST", path: "/transactions",
    description: "Records an expense, income or transfer. Transfers move money between two accounts (a credit-card payment is a transfer from a bank account to the card).",
    request: z.object({ spaceId, ...txnShape }), response: anyObject,
    handler: async (ctx, input) => {
      const { spaceId: sid, ...d } = input;
      if (d.kind === "transfer") { d.categoryId = null; d.envelopeId = null; } else d.toAccountId = null;
      await validateTxn(ctx, sid, d);
      const row = await ctx.db.insertInto("txn").values({
        id: ulid(), workspace_id: ctx.workspaceId, space_id: sid, created_by: ctx.userId,
        account_id: d.accountId, kind: d.kind, amount: d.amount, date: d.date, category_id: d.categoryId ?? null, to_account_id: d.toAccountId ?? null,
        payee: d.payee ?? null, note: d.note ?? null, method: d.method ?? null, tags: d.tags ?? [], envelope_id: d.envelopeId ?? null,
      }).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "updateTransaction", method: "PATCH", path: "/transactions/:id",
    description: "Edits a transaction (any field).",
    request: z.object({ id: z.string(), ...z.object(txnShape).partial().shape }), response: anyObject,
    handler: async (ctx, input) => {
      const { id, ...patch } = input;
      const ex = await getByIdInWorkspace(ctx, "txn", id);
      const merged: Record<string, any> = { accountId: ex.account_id, kind: ex.kind, toAccountId: ex.to_account_id, categoryId: ex.category_id, envelopeId: ex.envelope_id, ...patch };
      if (merged.kind === "transfer") { merged.categoryId = null; merged.envelopeId = null; } else merged.toAccountId = null;
      await validateTxn(ctx, ex.space_id, merged);
      const set: Record<string, any> = {};
      for (const [k, v] of Object.entries({ ...patch, categoryId: merged.categoryId, envelopeId: merged.envelopeId, toAccountId: merged.toAccountId })) if (v !== undefined) set[snake(k)] = v;
      const row = await ctx.db.updateTable("txn").set(set).where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "deleteTransaction", method: "DELETE", path: "/transactions/:id",
    description: "Deletes a transaction.", request: z.object({ id: z.string() }), response: ok,
    handler: async (ctx, { id }) => {
      await getByIdInWorkspace(ctx, "txn", id);
      await ctx.db.deleteFrom("txn").where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).execute();
      return { ok: true };
    },
  }),
  route({
    name: "listPayees", method: "GET", path: "/payees",
    description: "Distinct payees and tags used in a space (for autocomplete).",
    request: z.object({ spaceId }), response: z.object({ payees: z.array(z.string()), tags: z.array(z.string()) }),
    handler: async (ctx, { spaceId: sid }) => {
      const [p, t] = await Promise.all([
        sql<{ v: string }>`select payee as v from txn where workspace_id = ${ctx.workspaceId} and space_id = ${sid} and payee is not null group by payee order by count(*) desc limit 200`.execute(ctx.db),
        sql<{ v: string }>`select tag as v from (select unnest(tags) as tag from txn where workspace_id = ${ctx.workspaceId} and space_id = ${sid}) x group by tag order by count(*) desc limit 100`.execute(ctx.db),
      ]);
      return { payees: p.rows.map((r) => r.v), tags: t.rows.map((r) => r.v) };
    },
  }),
];

// ── budgets (monthly, per expense category) ────────────────────────────────
const budgetRoutes: RouteDef[] = [
  route({
    name: "listBudgets", method: "GET", path: "/budgets",
    description: "Monthly budgets with spending for a month (default current). Also returns spending in categories that have no budget.",
    request: z.object({ spaceId, month: month.optional() }),
    response: z.object({ month: z.string(), items: anyList, unbudgeted: anyList, totals: anyObject }),
    handler: async (ctx, { spaceId: sid, month: m }) => {
      await ensureSeeded(ctx, sid);
      const mo = m ?? currentMonth();
      const [from, to] = monthRange(mo);
      const spent = await sql<{ category_id: string | null; s: string }>`
        select category_id, sum(amount) as s from txn
         where workspace_id = ${ctx.workspaceId} and space_id = ${sid} and kind = 'expense' and date >= ${from} and date < ${to}
         group by category_id`.execute(ctx.db);
      const spentBy = new Map(spent.rows.map((r) => [r.category_id, num(r.s)]));
      const cats = await scoped(ctx.db.selectFrom("category").selectAll(), ctx, sid).where("kind", "=", "expense").orderBy("position").execute();
      const budgets = await scoped(ctx.db.selectFrom("budget").selectAll(), ctx, sid).execute();
      const byCat = new Map(budgets.map((b: any) => [b.category_id, b]));
      const items = cats.filter((c: any) => byCat.has(c.id)).map((c: any) => {
        const b: any = byCat.get(c.id), s = spentBy.get(c.id) ?? 0, amount = num(b.amount);
        return { id: b.id, categoryId: c.id, categoryName: c.name, color: c.color, amount, spent: round2(s), remaining: round2(amount - s), pct: amount > 0 ? round2((s / amount) * 100) : s > 0 ? 100 : 0 };
      });
      const unbudgeted = cats.filter((c: any) => !byCat.has(c.id) && (spentBy.get(c.id) ?? 0) > 0).map((c: any) => ({ categoryId: c.id, categoryName: c.name, color: c.color, spent: round2(spentBy.get(c.id) ?? 0) }));
      const uncategorized = spentBy.get(null) ?? 0;
      if (uncategorized > 0) unbudgeted.push({ categoryId: null as any, categoryName: "Uncategorized", color: "#9ca3af", spent: round2(uncategorized) });
      const budget = items.reduce((s, i) => s + i.amount, 0), spentIn = items.reduce((s, i) => s + i.spent, 0);
      return { month: mo, items, unbudgeted, totals: { budget: round2(budget), spent: round2(spentIn), remaining: round2(budget - spentIn), unbudgetedSpent: round2(unbudgeted.reduce((s, u) => s + u.spent, 0)) } };
    },
  }),
  route({
    name: "setBudget", method: "PUT", path: "/budgets",
    description: "Creates or updates the monthly budget for an expense category.",
    request: z.object({ spaceId, categoryId: z.string(), amount: money.pipe(z.number().min(0)) }), response: anyObject,
    handler: async (ctx, { spaceId: sid, categoryId, amount }) => {
      await assertOwned(ctx, "category", sid, categoryId, "category");
      const row = await ctx.db.insertInto("budget").values({ id: ulid(), workspace_id: ctx.workspaceId, space_id: sid, category_id: categoryId, amount })
        .onConflict((oc: any) => oc.columns(["space_id", "category_id"]).doUpdateSet({ amount })).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "deleteBudget", method: "DELETE", path: "/budgets/:id",
    description: "Removes a category budget.", request: z.object({ id: z.string() }), response: ok,
    handler: async (ctx, { id }) => {
      await getByIdInWorkspace(ctx, "budget", id);
      await ctx.db.deleteFrom("budget").where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).execute();
      return { ok: true };
    },
  }),
];

export const ledgerRoutes: RouteDef[] = [...accountRoutes, ...categoryRoutes, ...transactionRoutes, ...budgetRoutes];
