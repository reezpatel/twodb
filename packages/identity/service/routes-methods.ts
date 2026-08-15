import type { FastifyInstance } from "fastify";
import type { Principal } from "@twodb/contracts";
import type { AuthCtx } from "./ctx";
import {
	evaluateDisable,
	getDeploymentMethod,
	listUserMethods,
	methodAllowedByMode,
	upsertUserMethod,
} from "./methods";
import { hashPassword } from "./passwords";

const PUBLIC = { config: { public: true } };

/**
 * The two switches, over HTTP: what the deployment offers (superadmin),
 * what each user has enabled (themselves).
 */
export function registerMethodRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode } = ctx;

	/** What the deployment offers — drives the login screen. */
	fastify.get("/auth/methods", PUBLIC, async () => {
		const rows = await db
			.selectFrom("deployment_auth_methods")
			.select(["method"])
			.where("enabled", "=", true)
			.execute();
		return {
			methods: rows
				.map((r) => r.method)
				.filter((m) => methodAllowedByMode(m, mode)),
		};
	});

	fastify.get("/me/auth-methods", async (request) => {
		const { userId } = request.principal as Principal;
		const rows = await listUserMethods(db, userId);
		return {
			methods: rows.map((m) => ({
				id: m.id,
				method: m.method,
				enabled: m.enabled,
				createdAt: m.created_at,
			})),
		};
	});

	fastify.post("/me/auth-methods", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const body = request.body as { method?: string; password?: string };
		if (body.method === "password") {
			if (!body.password || body.password.length < 8) {
				return reply
					.code(400)
					.send({ error: "Password needs at least 8 characters." });
			}
			const offered = await getDeploymentMethod(db, "password");
			if (!offered?.enabled) {
				return reply.code(403).send({
					error: "Password sign-in is turned off on this server.",
				});
			}
			await upsertUserMethod(db, userId, "password", {
				hash: await hashPassword(body.password),
			});
			fastify.bus.emit("twodb.identity.authmethod.configured", {
				method: "password",
			});
			return reply.code(201).send({ ok: true });
		}
		if (body.method?.startsWith("sso.")) {
			const offered = await getDeploymentMethod(db, body.method);
			if (!offered?.enabled) {
				return reply
					.code(404)
					.send({ error: "Unknown sign-in provider." });
			}
			// Linking happens through the normal SSO flow: the provider's
			// verified identifier lands on this same user row.
			return {
				url: `${ctx.apiOrigin}/api/v1/twodb.identity/auth/sso/${body.method.slice(4)}`,
			};
		}
		return reply.code(400).send({ error: "Unknown sign-in method." });
	});

	fastify.patch("/me/auth-methods/:id", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const { id } = request.params as { id: string };
		const body = request.body as { enabled?: boolean };
		if (typeof body.enabled !== "boolean") {
			return reply.code(400).send({ error: "enabled must be true or false." });
		}
		const rows = await listUserMethods(db, userId);
		const target = rows.find((m) => m.id === id);
		if (!target) {
			return reply
				.code(404)
				.send({ error: "That sign-in method was not found." });
		}
		if (!body.enabled) {
			const verdict = evaluateDisable(rows, id);
			if (!verdict.ok) return reply.code(409).send({ error: verdict.error });
		}
		await db
			.updateTable("user_auth_methods")
			.set({ enabled: body.enabled })
			.where("id", "=", id)
			.execute();
		fastify.bus.emit("twodb.identity.authmethod.configured", {
			method: target.method,
		});
		return { ok: true };
	});

	/* ------------------------- superadmin switches ------------------------ */

	fastify.get("/admin/auth-methods", async (request, reply) => {
		const principal = request.principal as Principal;
		if (!principal.isSuperadmin) {
			return reply.code(403).send({ error: "Superadmins only." });
		}
		const rows = await db
			.selectFrom("deployment_auth_methods")
			.select(["method", "enabled", "config"])
			.orderBy("method")
			.execute();
		return {
			methods: rows.map((r) => ({
				method: r.method,
				enabled: r.enabled,
				// Never hand client secrets back over the wire.
				config: { ...r.config, clientSecret: r.config.clientSecret ? "•••" : undefined },
			})),
		};
	});

	fastify.put("/admin/auth-methods", async (request, reply) => {
		const principal = request.principal as Principal;
		if (!principal.isSuperadmin) {
			return reply.code(403).send({ error: "Superadmins only." });
		}
		const body = request.body as {
			method?: string;
			enabled?: boolean;
			config?: Record<string, unknown>;
		};
		const method = body.method ?? "";
		const valid =
			["password", "email_link", "phone_otp"].includes(method) ||
			/^sso\.[a-z0-9._-]+$/.test(method);
		if (!valid || typeof body.enabled !== "boolean") {
			return reply.code(400).send({
				error: "method (password | email_link | phone_otp | sso.<provider>) and enabled are required.",
			});
		}
		if (!methodAllowedByMode(method, mode)) {
			return reply.code(400).send({
				error: `${method} needs a different identifier mode on this server.`,
			});
		}
		const config = (body.config ?? {}) as Record<string, unknown>;
		if (method.startsWith("sso.") && body.enabled) {
			const hasEndpoints =
				typeof config.authorizationEndpoint === "string" &&
				typeof config.tokenEndpoint === "string" &&
				typeof config.userinfoEndpoint === "string";
			if (
				typeof config.clientId !== "string" ||
				typeof config.clientSecret !== "string" ||
				(typeof config.issuer !== "string" && !hasEndpoints)
			) {
				return reply.code(400).send({
					error:
						"An SSO provider needs clientId, clientSecret, and either an issuer (for discovery) or explicit endpoints.",
				});
			}
		}
		await db
			.insertInto("deployment_auth_methods")
			.values({ method, config, enabled: body.enabled })
			.onConflict((oc) =>
				oc.column("method").doUpdateSet({
					enabled: body.enabled!,
					// Config only changes when sent — toggling never wipes it.
					...(body.config ? { config } : {}),
				}),
			)
			.execute();
		fastify.bus.emit("twodb.identity.authmethod.configured", { method });
		return { ok: true };
	});
}
