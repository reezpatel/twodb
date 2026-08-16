import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { newId } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import {
	explainSignIn,
	findUserByLoginIdentifier,
	getUserMethod,
	upsertUserMethod,
} from "../../lib/users/methods";
import { startSession } from "../../lib/auth/signin";
import { PUBLIC } from "../../../shared/constants";
import { loadProvider, STATE_COOKIE } from "./sso-shared";

interface Userinfo {
	sub?: string;
	email?: string;
	email_verified?: boolean;
	phone_number?: string;
	phone_number_verified?: boolean;
	name?: string;
}

export function registerGetAuthSsoProviderCallback(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode, requireVerified } = ctx;

	const redirectUri = (provider: string) =>
		`${ctx.apiOrigin}/api/v1/twodb.identity/auth/sso/${provider}/callback`;

	fastify.get(
		"/auth/sso/:provider/callback",
		PUBLIC,
		async (request, reply) => {
			const { provider } = request.params as { provider: string };
			const { code, state } = request.query as {
				code?: string;
				state?: string;
			};
			const cookieState = request.cookies[STATE_COOKIE];
			reply.clearCookie(STATE_COOKIE, { path: "/" });
			const generic = reply.code(401).send({
				error: "That sign-in didn't check out. Try again.",
			});
			if (!code || !state || !cookieState || cookieState !== state)
				return generic;

			const found = await loadProvider(provider, ctx);
			if (!found) return generic;

			const tokenRes = await fetch(found.endpoints.tokenEndpoint, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code,
					redirect_uri: redirectUri(provider),
					client_id: found.config.clientId!,
					client_secret: found.config.clientSecret!,
				}),
			});
			if (!tokenRes.ok) return generic;
			const { access_token: accessToken } = (await tokenRes.json()) as {
				access_token?: string;
			};
			if (!accessToken) return generic;

			const infoRes = await fetch(found.endpoints.userinfoEndpoint, {
				headers: { authorization: `Bearer ${accessToken}` },
			});
			if (!infoRes.ok) return generic;
			const info = (await infoRes.json()) as Userinfo;
			if (!info.sub) return generic;

			// The identifier claim this deployment signs people in with — and it
			// must be provider-verified when the provider makes a claim at all.
			const email = info.email?.trim().toLowerCase() || null;
			const phone = info.phone_number?.trim() || null;
			const claim = mode === "phone" ? phone : email;
			if (!claim) {
				return reply.code(401).send({
					error:
						mode === "phone"
							? "Your provider didn't return a phone number."
							: "Your provider didn't return an email address.",
				});
			}
			if (mode !== "phone" && info.email_verified === false) {
				return reply
					.code(401)
					.send({ error: "Your provider couldn't confirm your email." });
			}
			if (mode === "phone" && info.phone_number_verified === false) {
				return reply
					.code(401)
					.send({ error: "Your provider couldn't confirm your phone number." });
			}

			const method = `sso.${provider}`;
			let issuer: string;
			try {
				issuer =
					found.config.issuer ??
					new URL(found.endpoints.authorizationEndpoint).origin;
			} catch {
				return generic;
			}

			const completeSignIn = async (userId: string, m: string) => {
				const user = await db
					.selectFrom("users")
					.selectAll()
					.where("id", "=", userId)
					.executeTakeFirstOrThrow();
				const verdict = await explainSignIn(db, user, m, {
					mode,
					requireVerified,
				});
				if (!verdict.ok) {
					if (verdict.reason === "verify_required") {
						return reply.code(403).send({ error: "verify_required" });
					}
					return generic;
				}
				await startSession(fastify, reply, db, user.id, m);
				return reply.redirect("/");
			};

			// 1. An existing link signs straight in.
			const link = await db
				.selectFrom("user_auth_methods")
				.select(["user_id"])
				.where("method", "=", method)
				.where(sql`credential ->> 'subject'`, "=", info.sub)
				.executeTakeFirst();
			if (link) return completeSignIn(link.user_id, method);

			// 2. Link, never duplicate: a trusted identifier lands on the same row.
			const user = await findUserByLoginIdentifier(db, mode, claim);
			if (user) {
				const existing = await getUserMethod(db, user.id, method);
				if (existing && existing.credential.subject !== info.sub) {
					return reply.code(401).send({
						error:
							"This account is linked to a different sign-in at that provider.",
					});
				}
				if (!existing) {
					await upsertUserMethod(db, user.id, method, {
						issuer,
						subject: info.sub,
					});
				}
				await stampVerified(user.id, email, phone);
				return completeSignIn(user.id, method);
			}

			// 3. First sight: create the row, respecting the identifier mode.
			const userId = newId("usr");
			await db
				.insertInto("users")
				.values({
					id: userId,
					identifier: mode === "phone" ? phone! : email!,
					email,
					phone,
					name: info.name?.trim() || email?.split("@")[0] || "friend",
					email_verified_at:
						email && info.email_verified !== false ? new Date() : null,
					phone_verified_at:
						phone && info.phone_number_verified !== false ? new Date() : null,
				})
				.execute();
			await upsertUserMethod(db, userId, method, { issuer, subject: info.sub });
			fastify.bus.emit("twodb.identity.user.created", { userId });
			return completeSignIn(userId, method);

			async function stampVerified(
				userId: string,
				verifiedEmail: string | null,
				verifiedPhone: string | null,
			): Promise<void> {
				const current = await db
					.selectFrom("users")
					.select(["email", "phone", "email_verified_at", "phone_verified_at"])
					.where("id", "=", userId)
					.executeTakeFirst();
				if (!current) return;
				const patch: {
					email_verified_at?: Date;
					phone_verified_at?: Date;
				} = {};
				if (
					verifiedEmail &&
					current.email === verifiedEmail &&
					current.email_verified_at === null
				) {
					patch.email_verified_at = new Date();
				}
				if (
					verifiedPhone &&
					current.phone === verifiedPhone &&
					current.phone_verified_at === null
				) {
					patch.phone_verified_at = new Date();
				}
				if (Object.keys(patch).length > 0) {
					await db
						.updateTable("users")
						.set(patch)
						.where("id", "=", userId)
						.execute();
				}
			}
		},
	);
}
