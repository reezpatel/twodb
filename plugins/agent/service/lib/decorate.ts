import type { FastifyInstance } from "fastify";
import type { AgentProviderRegistry, AgentSummary } from "@twodb/contracts";
import type { Kysely } from "kysely";
import type { AgentDB } from "../db/schema";
import type { AgentThreadRuntime } from "../runner/agent-runtime";

/**
 * The agent plugin's inter-plugin API. Other plugins consume these through
 * the fastify instance instead of reaching into this plugin's schema.
 */
export function decorateAgentFunctions(
	fastify: FastifyInstance,
	db: Kysely<AgentDB>,
	runtime: AgentThreadRuntime,
	registry: AgentProviderRegistry,
): void {
	fastify.decorate("agents", runtime);
	fastify.decorate("agentProviderRegistry", registry);

	fastify.decorate(
		"agentList",
		async (workspaceId: string): Promise<AgentSummary[]> =>
			db
				.selectFrom("agent_agents")
				.select(["id", "name", "provider", "model", "enabled"])
				.where("workspace_id", "=", workspaceId)
				.orderBy("name", "asc")
				.execute(),
	);
}
