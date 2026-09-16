import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { Selectable } from "kysely";
import type { AgentUsageSnapshotsTable } from "../db/schema";
import type { AgentCtx } from "../lib/ctx";
import { requireWorkspace } from "../lib/require-workspace";
import type {
	AgentUsageDto,
	AgentUsageSnapshotDto,
	AgentUsageWindowType,
} from "../../shared/types";
import { USAGE_PROVIDERS } from "../usage";

type AgentParams = { id: string };
type HistoryQuery = { window_type?: string; limit?: string };

const toSnapshotDto = (
	row: Selectable<AgentUsageSnapshotsTable>,
): AgentUsageSnapshotDto => ({
	id: row.id,
	window_type: row.window_type as AgentUsageWindowType,
	group_label: row.group_label,
	total: row.total,
	used: row.used,
	unit: row.unit as AgentUsageSnapshotDto["unit"],
	reset_at: row.reset_at?.toISOString() ?? null,
	captured_at: row.captured_at.toISOString(),
});

const loadAgent = async (ctx: AgentCtx, id: string, workspaceId: string) =>
	ctx.db
		.selectFrom("agent_agents")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();

const latestPerWindow = (
	rows: Selectable<AgentUsageSnapshotsTable>[],
): Selectable<AgentUsageSnapshotsTable>[] => {
	const latest = new Map<string, Selectable<AgentUsageSnapshotsTable>>();
	for (const row of rows) {
		const key = `${row.window_type}${row.group_label}`;
		if (!latest.has(key)) latest.set(key, row);
	}
	return [...latest.values()];
};

const currentUsage = async (
	ctx: AgentCtx,
	agentId: string,
): Promise<AgentUsageDto> => {
	const rows = await ctx.db
		.selectFrom("agent_usage_snapshots")
		.selectAll()
		.where("agent_id", "=", agentId)
		.orderBy("captured_at", "desc")
		.limit(200)
		.execute();

	const agent = await ctx.db
		.selectFrom("agent_agents")
		.select(["usage_last_fetched_at", "usage_last_error"])
		.where("id", "=", agentId)
		.executeTakeFirst();

	return {
		snapshots: latestPerWindow(rows).map(toSnapshotDto),
		last_fetched_at: agent?.usage_last_fetched_at?.toISOString() ?? null,
		last_error: agent?.usage_last_error ?? null,
	};
};

export function registerUsageRoutes(
	fastify: TwodbFastifyInstance,
	ctx: AgentCtx,
): void {
	// Latest snapshot per window for every agent in the workspace — one query
	// for list surfaces (rows show smallest + largest window inline).
	fastify.get("/agents/usage/summary", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const agents = await ctx.db
			.selectFrom("agent_agents")
			.select("id")
			.where("workspace_id", "=", workspaceId)
			.execute();
		if (agents.length === 0) return { summaries: {} };

		const rows = await ctx.db
			.selectFrom("agent_usage_snapshots")
			.selectAll()
			.where(
				"agent_id",
				"in",
				agents.map((a) => a.id),
			)
			.orderBy("captured_at", "desc")
			.limit(2000)
			.execute();

		const byAgent = new Map<string, Selectable<AgentUsageSnapshotsTable>[]>();
		for (const row of rows) {
			const list = byAgent.get(row.agent_id) ?? [];
			if (list.length < 200) list.push(row);
			byAgent.set(row.agent_id, list);
		}

		const summaries: Record<string, AgentUsageSnapshotDto[]> = {};
		for (const [agentId, agentRows] of byAgent) {
			summaries[agentId] = latestPerWindow(agentRows).map(toSnapshotDto);
		}
		return { summaries };
	});

	fastify.get("/agents/:id/usage", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as AgentParams;
		const agent = await loadAgent(ctx, id, workspaceId);
		if (!agent) return reply.code(404).send({ error: "agent not found" });
		return { usage: await currentUsage(ctx, id) };
	});

	fastify.get("/agents/:id/usage/history", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as AgentParams;
		const agent = await loadAgent(ctx, id, workspaceId);
		if (!agent) return reply.code(404).send({ error: "agent not found" });

		const query = request.query as HistoryQuery;
		const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 1000);
		const rows = await ctx.db
			.selectFrom("agent_usage_snapshots")
			.selectAll()
			.where("agent_id", "=", id)
			.$if(typeof query.window_type === "string", (q) =>
				q.where("window_type", "=", query.window_type!),
			)
			.orderBy("captured_at", "desc")
			.limit(limit)
			.execute();
		return { snapshots: rows.map(toSnapshotDto) };
	});

	fastify.post("/agents/:id/usage/refresh", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as AgentParams;
		const agent = await loadAgent(ctx, id, workspaceId);
		if (!agent) return reply.code(404).send({ error: "agent not found" });
		if (!USAGE_PROVIDERS[agent.provider]) {
			return reply
				.code(400)
				.send({ error: `provider "${agent.provider}" has no usage fetcher` });
		}

		const summary = await ctx.collector.collectDue({
			agentId: id,
			force: true,
		});
		return { summary, usage: await currentUsage(ctx, id) };
	});
}
