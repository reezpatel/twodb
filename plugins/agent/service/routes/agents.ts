import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { AgentCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { requireProviderType, splitConfig } from "../lib/registry";
import { jsonb, toAgentDto } from "../lib/serialize";
import type { AgentSecretPayload } from "../lib/crypto";
import { USAGE_PROVIDERS } from "../usage";
import type { UsageCredentials } from "../usage/base";
import { persistSecretUpdates } from "../usage/collector";

type AgentParams = { id: string };

type AgentBody = {
	name?: string;
	description?: string;
	provider?: string;
	api_key?: string | null;
	config?: Record<string, string>;
	model?: string | null;
	system_prompt?: string | null;
	options?: Record<string, unknown>;
	enabled?: boolean;
};

type VerifyBody = {
	provider?: string;
	api_key?: string | null;
	config?: Record<string, string>;
	agent_id?: string;
};

const optionalText = (value: unknown): string | null | undefined => {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== "string") throw new Error("expected a string");
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const badRequest = (
	reply: { code: (n: number) => { send: (b: unknown) => unknown } },
	error: unknown,
) => reply.code(400).send({ error: (error as Error).message });

/**
 * Effective credentials for verification: pasted values win; blank secret
 * inputs fall back to the stored payload (edit-flow "keep" semantics).
 * Nothing is persisted and no snapshots are written.
 */
const resolveVerifyCredentials = async (
	ctx: AgentCtx,
	workspaceId: string,
	input: {
		api_key?: string | null;
		agent_id?: string;
		secretFields: Record<string, string>;
	},
	providerId: string,
): Promise<{ creds: UsageCredentials; agentId: string | null }> => {
	let apiKey =
		typeof input.api_key === "string" && input.api_key.length > 0
			? input.api_key
			: undefined;
	const fields = { ...input.secretFields };
	let agentId: string | null = null;

	if (input.agent_id) {
		const existing = await ctx.db
			.selectFrom("agent_agents")
			.selectAll()
			.where("id", "=", input.agent_id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (existing && existing.provider === providerId) {
			agentId = existing.id;
			const payload = existing.secret_encrypted
				? ctx.secrets.decrypt(existing.secret_encrypted)
				: null;
			if (!apiKey && payload?.api_key) apiKey = payload.api_key;
			for (const [key, value] of Object.entries(payload?.fields ?? {})) {
				if (!fields[key]) fields[key] = value;
			}
		}
	}

	const creds: UsageCredentials = { fields };
	if (apiKey) creds.apiKey = apiKey;
	return { creds, agentId };
};

export function registerAgentRoutes(
	fastify: TwodbFastifyInstance,
	ctx: AgentCtx,
): void {
	fastify.get("/agents", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const agents = await ctx.db
			.selectFrom("agent_agents")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("created_at", "asc")
			.execute();
		return { agents: agents.map((row) => toAgentDto(row, ctx.secrets)) };
	});

	fastify.post("/agents", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = (request.body ?? {}) as AgentBody;

		try {
			const name = optionalText(body.name);
			if (!name) throw new Error("name is required");
			const provider = requireProviderType(body.provider);
			const { config, secretFields } = splitConfig(provider, body.config);

			const payload: AgentSecretPayload = { fields: secretFields };
			if (typeof body.api_key === "string" && body.api_key.length > 0) {
				payload.api_key = body.api_key;
			}
			const hasSecret =
				payload.api_key !== undefined || Object.keys(payload.fields).length > 0;

			const id = newId("agt");
			await ctx.db
				.insertInto("agent_agents")
				.values({
					id,
					workspace_id: workspaceId,
					name,
					description: optionalText(body.description) ?? null,
					provider: provider.id,
					secret_encrypted: hasSecret ? ctx.secrets.encrypt(payload) : null,
					config: jsonb(config),
					model: optionalText(body.model) ?? null,
					system_prompt:
						typeof body.system_prompt === "string" ? body.system_prompt : null,
					options: jsonb(body.options ?? {}),
					created_by: principalOf(request).userId,
				})
				.execute();

			const row = await ctx.db
				.selectFrom("agent_agents")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow();
			return reply.code(201).send({ agent: toAgentDto(row, ctx.secrets) });
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.post("/agents/verify", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = (request.body ?? {}) as VerifyBody;

		try {
			const provider = requireProviderType(body.provider);
			const entry = USAGE_PROVIDERS[provider.id];
			if (!entry) {
				throw new Error(
					`provider "${provider.id}" does not support verification`,
				);
			}

			const { secretFields } = splitConfig(provider, body.config);
			const { creds, agentId } = await resolveVerifyCredentials(
				ctx,
				workspaceId,
				{ api_key: body.api_key, agent_id: body.agent_id, secretFields },
				provider.id,
			);
			const fetcher = entry.create(creds);
			try {
				const snapshots = await fetcher.collect();
				// verifying an existing agent rotates one-shot refresh tokens —
				// persist them so the stored credential survives
				if (agentId) {
					await persistSecretUpdates(ctx.db, ctx.secrets, agentId, fetcher);
				}
				return {
					groups: [...new Set(snapshots.map((snapshot) => snapshot.group))],
					snapshots: snapshots.map((snapshot) => ({
						window_type: snapshot.type,
						group_label: snapshot.group,
						total: snapshot.total,
						used: snapshot.used,
						unit: snapshot.unit,
						reset_at: snapshot.resetIso,
					})),
				};
			} catch (error) {
				if (agentId) {
					await persistSecretUpdates(
						ctx.db,
						ctx.secrets,
						agentId,
						fetcher,
					).catch(() => undefined);
				}
				throw error;
			}
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.get("/agents/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as AgentParams;
		const row = await ctx.db
			.selectFrom("agent_agents")
			.selectAll()
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!row) return reply.code(404).send({ error: "agent not found" });
		return { agent: toAgentDto(row, ctx.secrets) };
	});

	fastify.patch("/agents/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as AgentParams;
		const body = (request.body ?? {}) as AgentBody;

		const existing = await ctx.db
			.selectFrom("agent_agents")
			.selectAll()
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!existing) return reply.code(404).send({ error: "agent not found" });

		try {
			const updates: Record<string, unknown> = {
				updated_at: new Date(),
			};

			const name = optionalText(body.name);
			if (name !== undefined) {
				if (!name) throw new Error("name cannot be empty");
				updates.name = name;
			}
			const description = optionalText(body.description);
			if (description !== undefined) updates.description = description;
			const model = optionalText(body.model);
			if (model !== undefined) updates.model = model;
			if (body.system_prompt !== undefined) {
				updates.system_prompt =
					typeof body.system_prompt === "string" ? body.system_prompt : null;
			}
			if (body.options !== undefined) {
				if (typeof body.options !== "object" || body.options === null) {
					throw new Error("options must be an object");
				}
				updates.options = jsonb(body.options);
			}
			if (body.enabled !== undefined) {
				if (typeof body.enabled !== "boolean") {
					throw new Error("enabled must be a boolean");
				}
				updates.enabled = body.enabled;
			}

			const provider = body.provider
				? requireProviderType(body.provider)
				: undefined;
			if (provider) updates.provider = provider.id;

			// Secret material: merge against the existing payload. api_key
			// undefined = keep, null/"" = clear, string = replace.
			const touchesSecrets =
				body.api_key !== undefined || body.config !== undefined;
			if (touchesSecrets) {
				const current: AgentSecretPayload = existing.secret_encrypted
					? (ctx.secrets.decrypt(existing.secret_encrypted) ?? {
							fields: {},
						})
					: { fields: {} };
				const next: AgentSecretPayload = {
					fields: { ...current.fields },
				};
				if (current.api_key !== undefined) next.api_key = current.api_key;

				if (body.api_key === null || body.api_key === "") {
					delete next.api_key;
				} else if (typeof body.api_key === "string") {
					next.api_key = body.api_key;
				}

				if (body.config !== undefined) {
					const template = provider ?? requireProviderType(existing.provider);
					const split = splitConfig(template, body.config, false);
					updates.config = jsonb(split.config);
					// Secret fields follow the api_key keep/clear/replace semantics:
					// absent = keep, "" = clear, value = replace. Keys that are not
					// secret fields of the (possibly new) template are dropped.
					const rawConfig = body.config;
					const secretKeys = new Set(
						template.fields.filter((f) => f.secret).map((f) => f.key),
					);
					for (const key of Object.keys(next.fields)) {
						if (!secretKeys.has(key)) delete next.fields[key];
					}
					for (const key of secretKeys) {
						const raw = rawConfig[key];
						if (raw === undefined) continue;
						if (raw === "") delete next.fields[key];
						else next.fields[key] = raw;
					}
				}

				const hasSecret =
					next.api_key !== undefined || Object.keys(next.fields).length > 0;
				updates.secret_encrypted = hasSecret ? ctx.secrets.encrypt(next) : null;
			}

			await ctx.db
				.updateTable("agent_agents")
				.set(updates)
				.where("id", "=", id)
				.execute();

			const row = await ctx.db
				.selectFrom("agent_agents")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow();
			return { agent: toAgentDto(row, ctx.secrets) };
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.delete("/agents/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as AgentParams;
		const result = await ctx.db
			.deleteFrom("agent_agents")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (result.numDeletedRows === 0n) {
			return reply.code(404).send({ error: "agent not found" });
		}
		return { deleted: true };
	});
}
