import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
	rootServicePlugin,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import { agentDb } from "./db";
import { buildMigrations } from "./db/migrations";
import type { AgentCtx } from "./lib/ctx";
import { SecretBox } from "./lib/crypto";
import { decorateAgentFunctions } from "./lib/decorate";
import { createAgentProviderRegistry } from "./lib/provider-registry";
import { AgentThreadRuntime } from "./runner/agent-runtime";
import { registerRoutes } from "./routes";
import { UsageCollector } from "./usage/collector";
import { PLUGIN_ID } from "../shared/constants";
import { agentManifest } from "../shared/manifest";

export const TwodbAgentServiceManifest = {
	...agentManifest,

	permissions: [
		{
			permission: "plugin.twodb.agent:agents.read",
			description: "List and view agents",
		},
		{
			permission: "plugin.twodb.agent:agents.manage",
			description: "Create, edit and delete agents and their credentials",
		},
		{
			permission: "plugin.twodb.agent:threads.read",
			description: "List and view agent threads and messages",
		},
		{
			permission: "plugin.twodb.agent:threads.manage",
			description: "Create threads, run and stop agents",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.agent:agents.read",
			"plugin.twodb.agent:agents.manage",
			"plugin.twodb.agent:threads.read",
			"plugin.twodb.agent:threads.manage",
		],
		member: [
			"plugin.twodb.agent:agents.read",
			"plugin.twodb.agent:threads.read",
		],
	},

	plugin: rootServicePlugin("twodb-agent-service", async (fastify) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		const config = (
			fastify as unknown as {
				config: {
					TWODB_AGENT_ENCRYPTION_KEY: string;
					TWODB_AGENT_USAGE_INTERVAL_MS: number;
				};
			}
		).config;

		const db = agentDb(fastify);
		const secrets = new SecretBox(config.TWODB_AGENT_ENCRYPTION_KEY);
		const registry = createAgentProviderRegistry();
		const runtime = new AgentThreadRuntime({
			db,
			secrets,
			registry,
			emit: (event, payload) => fastify.bus.emit(event, payload),
		});
		decorateAgentFunctions(fastify, db, runtime, registry);

		const ctx: AgentCtx = {
			db,
			secrets,
			collector: new UsageCollector(db, secrets),
			runtime,
		};

		// Usage cron: ticks on a fixed interval, but each provider is only
		// refetched once its own TTL elapsed (see UsageCollector).
		const collect = () => {
			ctx.collector.collectDue().catch((error: unknown) => {
				fastify.log.warn(
					`agent usage collection failed: ${(error as Error).message}`,
				);
			});
		};
		const timer = setInterval(collect, config.TWODB_AGENT_USAGE_INTERVAL_MS);
		timer.unref();
		fastify.addHook("onClose", async () => {
			clearInterval(timer);
		});
		collect();

		return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
	}),
};

export const service = TwodbAgentServiceManifest;

export default TwodbAgentServiceManifest;
