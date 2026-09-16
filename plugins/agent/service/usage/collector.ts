import { newId } from "@twodb/shared-backend";
import type { Kysely } from "kysely";
import type { Selectable } from "kysely";
import type { AgentAgentsTable, AgentDB } from "../db/schema";
import type { SecretBox } from "../lib/crypto";
import type { UsageCredentials, UsageProvider } from "./base";
import { USAGE_PROVIDERS } from "./index";

export type CollectSummary = {
	fetched: number;
	skipped: number;
	failed: number;
};

export type CollectOptions = {
	/** restrict to one agent (used by the manual refresh endpoint) */
	agentId?: string;
	/** bypass the per-provider TTL (manual refresh) */
	force?: boolean;
};

/**
 * Persists secret-field updates produced during a run (e.g. OAuth tokens
 * rotated by a refresh) back into the agent's encrypted blob. Shared by
 * the collector and the verify endpoint — must run even when the usage
 * fetch failed, since one-shot rotation already happened.
 */
export const persistSecretUpdates = async (
	db: Kysely<AgentDB>,
	secrets: SecretBox,
	agentId: string,
	provider: UsageProvider,
): Promise<void> => {
	const updates = provider.takeSecretUpdates();
	if (!updates || Object.keys(updates).length === 0) return;
	const existing = await db
		.selectFrom("agent_agents")
		.select(["secret_encrypted"])
		.where("id", "=", agentId)
		.executeTakeFirst();
	const payload = existing?.secret_encrypted
		? (secrets.decrypt(existing.secret_encrypted) ?? { fields: {} })
		: { fields: {} };
	await db
		.updateTable("agent_agents")
		.set({
			secret_encrypted: secrets.encrypt({
				...payload,
				fields: { ...payload.fields, ...updates },
			}),
			updated_at: new Date(),
		})
		.where("id", "=", agentId)
		.execute();
};

/**
 * Collects usage snapshots for all enabled agents whose provider has a
 * fetcher. The cron ticks on a fixed interval, but a provider is only
 * refetched once its own TTL has elapsed — the TTL also throttles retries
 * after a failure, so a broken credential is not hammered every tick.
 */
export class UsageCollector {
	constructor(
		private readonly db: Kysely<AgentDB>,
		private readonly secrets: SecretBox,
	) {}

	async collectDue(options: CollectOptions = {}): Promise<CollectSummary> {
		const agents = await this.db
			.selectFrom("agent_agents")
			.selectAll()
			.where("enabled", "=", true)
			.$if(options.agentId !== undefined, (query) =>
				query.where("id", "=", options.agentId!),
			)
			.execute();

		const summary: CollectSummary = { fetched: 0, skipped: 0, failed: 0 };

		for (const agent of agents) {
			const provider = USAGE_PROVIDERS[agent.provider];
			if (!provider) {
				summary.skipped++;
				continue;
			}

			const lastFetched = agent.usage_last_fetched_at?.getTime();
			if (
				!options.force &&
				lastFetched !== undefined &&
				Date.now() - lastFetched < provider.ttlMs
			) {
				summary.skipped++;
				continue;
			}

			let fetcher: UsageProvider | null = null;
			try {
				fetcher = provider.create(this.credentialsOf(agent));
				const snapshots = await fetcher.collect();
				await persistSecretUpdates(this.db, this.secrets, agent.id, fetcher);

				for (const snapshot of snapshots) {
					await this.db
						.insertInto("agent_usage_snapshots")
						.values({
							id: newId("aus"),
							agent_id: agent.id,
							workspace_id: agent.workspace_id,
							window_type: snapshot.type,
							group_label: snapshot.group,
							total: snapshot.total,
							used: snapshot.used,
							unit: snapshot.unit,
							reset_at: snapshot.resetIso ? new Date(snapshot.resetIso) : null,
						})
						.execute();
				}

				await this.db
					.updateTable("agent_agents")
					.set({
						usage_last_fetched_at: new Date(),
						usage_last_error: null,
					})
					.where("id", "=", agent.id)
					.execute();
				summary.fetched++;
			} catch (error) {
				// a rotation that happened before the failure is still valid —
				// persist it or the stored refresh token stays stale
				if (fetcher) {
					await persistSecretUpdates(
						this.db,
						this.secrets,
						agent.id,
						fetcher,
					).catch(() => undefined);
				}
			}
		}

		return summary;
	}

	private credentialsOf(agent: Selectable<AgentAgentsTable>): UsageCredentials {
		const payload = agent.secret_encrypted
			? this.secrets.decrypt(agent.secret_encrypted)
			: null;
		return {
			...(payload?.api_key ? { apiKey: payload.api_key } : {}),
			fields: payload?.fields ?? {},
		};
	}
}
