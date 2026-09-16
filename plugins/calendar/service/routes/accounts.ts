import type { CalendarProvider } from "@twodb/contracts";
import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import { connectorFor } from "../connectors";
import { CALENDAR_PROVIDERS } from "../../shared/constants";
import type { CalendarCtx } from "../lib/ctx";
import { CredentialBox, type CalendarCredentials } from "../lib/crypto";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toAccountDto } from "../lib/serialize";
import { syncAccount } from "../lib/sync";

interface CreateAccountBody {
	provider: CalendarProvider;
	label: string;
	email?: string;
	/** ICS feed / CalDAV base URL. */
	remote_url?: string;
	/** CalDAV basic auth. */
	username?: string;
	password?: string;
}

interface ExchangeBody {
	code: string;
	redirect_uri: string;
}

export function registerAccountRoutes(
	fastify: FastifyInstance,
	ctx: CalendarCtx,
): void {
	fastify.get("/accounts", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const accounts = await ctx.db
			.selectFrom("cal_accounts")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("created_at", "asc")
			.execute();
		return { accounts: accounts.map(toAccountDto) };
	});

	fastify.post<{ Body: CreateAccountBody }>(
		"/accounts",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const body = request.body;
			if (!body?.provider || !CALENDAR_PROVIDERS.includes(body.provider)) {
				return reply.code(400).send({ error: "Unknown provider." });
			}
			if (!body.label?.trim()) {
				return reply.code(400).send({ error: "label is required." });
			}
			if (
				(body.provider === "ics" || body.provider === "caldav") &&
				!body.remote_url
			) {
				return reply
					.code(400)
					.send({ error: "remote_url is required for this provider." });
			}

			let credentials: string | null = null;
			if (body.username || body.password) {
				if (!ctx.credentialsKey) {
					return reply.code(500).send({
						error: "TWODB_CALENDAR_ENCRYPTION_KEY is not configured.",
					});
				}
				credentials = new CredentialBox(ctx.credentialsKey).encrypt({
					username: body.username,
					password: body.password,
				});
			}

			const account = await ctx.db
				.insertInto("cal_accounts")
				.values({
					id: newId("acc"),
					workspace_id: workspaceId,
					provider: body.provider,
					label: body.label.trim(),
					email: body.email ?? null,
					credentials,
					remote_url: body.remote_url ?? null,
					created_by: principalOf(request).userId,
				})
				.returningAll()
				.executeTakeFirstOrThrow();

			// Local accounts are immediately active; remote ones go active
			// after their first successful sync (or OAuth exchange).
			if (body.provider === "local") {
				const updated = await ctx.db
					.updateTable("cal_accounts")
					.set({ status: "active", updated_at: new Date() })
					.where("id", "=", account.id)
					.returningAll()
					.executeTakeFirstOrThrow();
				return { account: toAccountDto(updated) };
			}
			return { account: toAccountDto(account) };
		},
	);

	fastify.delete<{ Params: { accountId: string } }>(
		"/accounts/:accountId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			await ctx.db
				.deleteFrom("cal_accounts")
				.where("id", "=", request.params.accountId)
				.where("workspace_id", "=", workspaceId)
				.execute();
			return { ok: true };
		},
	);

	/** OAuth start: returns the provider authorization URL. */
	fastify.get<{
		Params: { accountId: string };
		Querystring: { redirect_uri?: string };
	}>("/accounts/:accountId/auth-url", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const account = await ctx.db
			.selectFrom("cal_accounts")
			.selectAll()
			.where("id", "=", request.params.accountId)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!account) return reply.code(404).send({ error: "Not found." });

		const connector = connectorFor(account.provider);
		if (!connector?.authUrl) {
			return reply.code(400).send({ error: "Provider does not use OAuth." });
		}
		const redirectUri = request.query.redirect_uri;
		if (!redirectUri) {
			return reply.code(400).send({ error: "redirect_uri is required." });
		}
		return {
			url: connector.authUrl(redirectUri, account.id),
		};
	});

	/** OAuth finish: swap the code for tokens and kick off the first sync. */
	fastify.post<{ Params: { accountId: string }; Body: ExchangeBody }>(
		"/accounts/:accountId/exchange",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const account = await ctx.db
				.selectFrom("cal_accounts")
				.selectAll()
				.where("id", "=", request.params.accountId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!account) return reply.code(404).send({ error: "Not found." });

			const connector = connectorFor(account.provider);
			if (!connector?.exchangeCode) {
				return reply.code(400).send({ error: "Provider does not use OAuth." });
			}
			if (!ctx.credentialsKey) {
				return reply.code(500).send({
					error: "TWODB_CALENDAR_ENCRYPTION_KEY is not configured.",
				});
			}
			if (!request.body?.code || !request.body.redirect_uri) {
				return reply
					.code(400)
					.send({ error: "code and redirect_uri are required." });
			}

			const credentials: CalendarCredentials = await connector.exchangeCode(
				request.body.code,
				request.body.redirect_uri,
			);
			const updated = await ctx.db
				.updateTable("cal_accounts")
				.set({
					credentials: new CredentialBox(ctx.credentialsKey).encrypt(
						credentials,
					),
					updated_at: new Date(),
				})
				.where("id", "=", account.id)
				.returningAll()
				.executeTakeFirstOrThrow();

			const result = await syncAccount(ctx.db, ctx.credentialsKey, updated);
			const fresh = await ctx.db
				.selectFrom("cal_accounts")
				.selectAll()
				.where("id", "=", account.id)
				.executeTakeFirstOrThrow();
			return { account: toAccountDto(fresh), sync: result };
		},
	);

	/** Manually re-sync an account (feeds, CalDAV, or post-OAuth refresh). */
	fastify.post<{ Params: { accountId: string } }>(
		"/accounts/:accountId/sync",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const account = await ctx.db
				.selectFrom("cal_accounts")
				.selectAll()
				.where("id", "=", request.params.accountId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!account) return reply.code(404).send({ error: "Not found." });

			const result = await syncAccount(ctx.db, ctx.credentialsKey, account);
			const fresh = await ctx.db
				.selectFrom("cal_accounts")
				.selectAll()
				.where("id", "=", account.id)
				.executeTakeFirstOrThrow();
			return { account: toAccountDto(fresh), sync: result };
		},
	);
}
