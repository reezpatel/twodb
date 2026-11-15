import { z } from "zod";
import { sql } from "@twodb/core-data/db";
import { ulid } from "ulid";
import { route, type RouteDef } from "../lib/route.js";
import { crud } from "../lib/crud.js";
import { assertOwned, getByIdInWorkspace, scoped } from "../lib/scope.js";
import { num, round2, toApi, toApiList } from "../lib/rows.js";
import { badRequest } from "../lib/http.js";
import { loadAccounts } from "../lib/finance.js";
import { today } from "../lib/dates.js";
import { anyList, anyObject, envelopeShape, goalShape, isoDate, money, ok, spaceId } from "./schemas.js";

// ── envelopes ──────────────────────────────────────────────────────────────
// balance = allocations (+fund / −release) minus expenses tagged to the envelope.
const envelopeRoutes: RouteDef[] = [
  route({
    name: "listEnvelopes", method: "GET", path: "/envelopes",
    description: "Envelopes with funded / spent / balance. `unallocated` = spendable account money (bank, cash, UPI, wallet) not yet assigned to an envelope.",
    request: z.object({ spaceId, includeArchived: z.coerce.boolean().optional() }),
    response: z.object({ items: anyList, totalBalance: z.number(), unallocated: z.number() }),
    handler: async (ctx, { spaceId: sid, includeArchived }) => {
      const rows = await sql<Record<string, any>>`
        select e.*,
          coalesce((select sum(amount) from envelope_alloc a where a.envelope_id = e.id), 0) as funded,
          coalesce((select sum(amount) from txn t where t.envelope_id = e.id and t.kind = 'expense'), 0) as spent
        from envelope e where e.workspace_id = ${ctx.workspaceId} and e.space_id = ${sid} ${includeArchived ? sql`` : sql`and e.archived_at is null`}
        order by e.created_at`.execute(ctx.db);
      const items = rows.rows.map((r) => {
        const funded = num(r.funded), spent = num(r.spent), balance = round2(funded - spent), target = r.target === null ? null : num(r.target);
        return { ...toApi(r), funded: round2(funded), spent: round2(spent), balance, pct: target && target > 0 ? round2((balance / target) * 100) : null };
      });
      const accounts = await loadAccounts(ctx, sid);
      const spendable = accounts.filter((a) => a.type !== "credit_card" && a.includeInNetworth).reduce((s, a) => s + a.balance, 0);
      const totalBalance = round2(items.reduce((s, e) => s + e.balance, 0));
      return { items, totalBalance, unallocated: round2(spendable - totalBalance) };
    },
  }),
  ...crud({ singular: "Envelope", plural: "Envelopes", table: "envelope", path: "/envelopes", shape: envelopeShape, archivable: true, noList: true, describe: "envelopes" }),
  route({
    name: "allocateEnvelope", method: "POST", path: "/envelopes/:id/allocate",
    description: "Funds an envelope (positive amount) or releases money from it (negative).",
    request: z.object({ id: z.string(), amount: money.refine((n) => n !== 0, "amount must not be 0"), date: isoDate.optional(), note: z.string().max(200).optional() }), response: anyObject,
    handler: async (ctx, { id, amount, date, note }) => {
      const env = await getByIdInWorkspace(ctx, "envelope", id);
      const row = await ctx.db.insertInto("envelope_alloc").values({ id: ulid(), workspace_id: ctx.workspaceId, space_id: env.space_id, envelope_id: id, amount, date: date ?? today(), note: note ?? null, created_by: ctx.userId }).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "transferBetweenEnvelopes", method: "POST", path: "/envelopes/transfer",
    description: "Moves allocated money from one envelope to another.",
    request: z.object({ spaceId, fromId: z.string(), toId: z.string(), amount: money.pipe(z.number().positive()), note: z.string().max(200).optional() }), response: ok,
    handler: async (ctx, { spaceId: sid, fromId, toId, amount, note }) => {
      if (fromId === toId) throw badRequest("pick two different envelopes");
      await assertOwned(ctx, "envelope", sid, fromId); await assertOwned(ctx, "envelope", sid, toId);
      const base = { workspace_id: ctx.workspaceId, space_id: sid, date: today(), note: note ?? "Envelope transfer", created_by: ctx.userId };
      await ctx.db.insertInto("envelope_alloc").values([{ id: ulid(), envelope_id: fromId, amount: -amount, ...base }, { id: ulid(), envelope_id: toId, amount, ...base }]).execute();
      return { ok: true };
    },
  }),
  route({
    name: "fillEnvelopes", method: "POST", path: "/envelopes/fill",
    description: "Adds each envelope's monthly fill amount (the monthly top-up ritual).",
    request: z.object({ spaceId }), response: z.object({ filled: z.number(), total: z.number() }),
    handler: async (ctx, { spaceId: sid }) => {
      const envs = await scoped(ctx.db.selectFrom("envelope").selectAll(), ctx, sid).where("archived_at", "is", null).where("monthly_fill", ">", 0).execute();
      if (!envs.length) return { filled: 0, total: 0 };
      await ctx.db.insertInto("envelope_alloc").values(envs.map((e: any) => ({ id: ulid(), workspace_id: ctx.workspaceId, space_id: sid, envelope_id: e.id, amount: e.monthly_fill, date: today(), note: "Monthly fill", created_by: ctx.userId }))).execute();
      return { filled: envs.length, total: round2(envs.reduce((s: number, e: any) => s + num(e.monthly_fill), 0)) };
    },
  }),
  route({
    name: "envelopeHistory", method: "GET", path: "/envelopes/:id/history",
    description: "Allocations and tagged expenses of one envelope, newest first.",
    request: z.object({ id: z.string() }), response: z.object({ allocations: anyList, expenses: anyList }),
    handler: async (ctx, { id }) => {
      const env = await getByIdInWorkspace(ctx, "envelope", id);
      const [allocations, expenses] = await Promise.all([
        ctx.db.selectFrom("envelope_alloc").selectAll().where("envelope_id", "=", id).orderBy("date", "desc").orderBy("created_at", "desc").limit(200).execute(),
        scoped(ctx.db.selectFrom("txn").selectAll(), ctx, env.space_id).where("envelope_id", "=", id).orderBy("date", "desc").limit(200).execute(),
      ]);
      return { allocations: toApiList(allocations), expenses: toApiList(expenses) };
    },
  }),
  route({
    name: "deleteEnvelopeAllocation", method: "DELETE", path: "/envelope-allocations/:id",
    description: "Removes one allocation entry.", request: z.object({ id: z.string() }), response: ok,
    handler: async (ctx, { id }) => {
      await getByIdInWorkspace(ctx, "envelope_alloc", id);
      await ctx.db.deleteFrom("envelope_alloc").where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).execute();
      return { ok: true };
    },
  }),
];

// ── savings goals ──────────────────────────────────────────────────────────
const goalRoutes: RouteDef[] = [
  route({
    name: "listGoals", method: "GET", path: "/goals",
    description: "Savings goals with saved amount, progress and the monthly saving needed to hit the target date.",
    request: z.object({ spaceId, includeArchived: z.coerce.boolean().optional() }), response: anyList,
    handler: async (ctx, { spaceId: sid, includeArchived }) => {
      const rows = await sql<Record<string, any>>`
        select g.*, coalesce((select sum(amount) from goal_contribution c where c.goal_id = g.id), 0) as saved
        from goal g where g.workspace_id = ${ctx.workspaceId} and g.space_id = ${sid} ${includeArchived ? sql`` : sql`and g.archived_at is null`}
        order by g.created_at`.execute(ctx.db);
      const now = new Date();
      return rows.rows.map((r) => {
        const saved = num(r.saved), target = num(r.target_amount), api = toApi(r) as Record<string, any>;
        let monthsLeft: number | null = null, requiredMonthly: number | null = null;
        if (r.target_date) {
          const t = r.target_date as Date;
          monthsLeft = Math.max(0, (t.getFullYear() - now.getFullYear()) * 12 + t.getMonth() - now.getMonth());
          requiredMonthly = monthsLeft > 0 ? round2(Math.max(0, target - saved) / monthsLeft) : Math.max(0, round2(target - saved));
        }
        return { ...api, saved: round2(saved), pct: round2(Math.min(100, (saved / target) * 100)), monthsLeft, requiredMonthly };
      });
    },
  }),
  ...crud({ singular: "Goal", plural: "Goals", table: "goal", path: "/goals", shape: goalShape, archivable: true, noList: true, describe: "goals" }),
  route({
    name: "addGoalContribution", method: "POST", path: "/goals/:id/contributions",
    description: "Adds money to a goal (negative amount withdraws).",
    request: z.object({ id: z.string(), amount: money.refine((n) => n !== 0, "amount must not be 0"), date: isoDate.optional(), note: z.string().max(200).optional() }), response: anyObject,
    handler: async (ctx, { id, amount, date, note }) => {
      const g = await getByIdInWorkspace(ctx, "goal", id);
      const row = await ctx.db.insertInto("goal_contribution").values({ id: ulid(), workspace_id: ctx.workspaceId, space_id: g.space_id, goal_id: id, amount, date: date ?? today(), note: note ?? null, created_by: ctx.userId }).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "listGoalContributions", method: "GET", path: "/goals/:id/contributions",
    description: "Contribution history of a goal.", request: z.object({ id: z.string() }), response: anyList,
    handler: async (ctx, { id }) => {
      await getByIdInWorkspace(ctx, "goal", id);
      return toApiList(await ctx.db.selectFrom("goal_contribution").selectAll().where("goal_id", "=", id).orderBy("date", "desc").orderBy("created_at", "desc").execute());
    },
  }),
  route({
    name: "deleteGoalContribution", method: "DELETE", path: "/goal-contributions/:id",
    description: "Removes one contribution.", request: z.object({ id: z.string() }), response: ok,
    handler: async (ctx, { id }) => {
      await getByIdInWorkspace(ctx, "goal_contribution", id);
      await ctx.db.deleteFrom("goal_contribution").where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).execute();
      return { ok: true };
    },
  }),
];

export const planningRoutes: RouteDef[] = [...envelopeRoutes, ...goalRoutes];
