import type { FastifyInstance } from "fastify";
import type { Principal } from "@twodb/contracts";
import { consumeCode, consumeToken, issueCode } from "./codes";
import type { AuthCtx } from "./ctx";
import {
	canCompleteChallenge,
	canOfferChallenge,
	findUserByLoginIdentifier,
	getUserMethod,
	upsertUserMethod,
} from "./methods";
import { principalFor, startSession } from "./signin";

const PUBLIC = { config: { public: true } };
// Reachable for unverified sessions even when the verified-gate is on.
const VERIFY_EXEMPT = { config: { verifyExempt: true } };

const LINK_TTL_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * Code/link-based sign-in (email_link, phone_otp) and per-identifier
 * verification. Link routes exist only in email modes, otp routes only in
 * phone modes — elsewhere they 404 by simply not being registered.
 */
export function registerChallengeRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode } = ctx;
	const emailModes = mode !== "phone";
	const phoneModes = mode !== "email";

	/* ----------------------------- email_link ----------------------------- */

	if (emailModes) {
		fastify.post("/auth/link", PUBLIC, async (request, reply) => {
			const body = request.body as { email?: string };
			const email = body.email?.trim().toLowerCase();
			// Always 200 — never leak whether an address has an account.
			if (!email) return { ok: true };
			const user = await findUserByLoginIdentifier(db, mode, email);
			// Deployment + mode gate only. The link itself is the proof of
			// possession; the user-level switch is decided on the callback.
			const offer = await canOfferChallenge(db, "email_link", { mode });
			if (!offer.ok) return { ok: true };
			if (user) {
				const own = await getUserMethod(db, user.id, "email_link");
				// Refuse to re-enable a method the user explicitly disabled.
				if (own && !own.enabled) return { ok: true };
			}
			const token = await issueCode(db, email, "login", "token", LINK_TTL_MS);
			await fastify.mailer.send({
				to: email,
				subject: "Your twodb sign-in link",
				text: `Sign in to twodb: ${ctx.apiOrigin}/api/v1/twodb.identity/auth/link/${token}\n\nThis link works once, for 15 minutes.`,
			});
			return { ok: true };
		});

		fastify.get("/auth/link/:token", PUBLIC, async (request, reply) => {
			const { token } = request.params as { token: string };
			const email = await consumeToken(db, "login", token);
			const user = email
				? await findUserByLoginIdentifier(db, mode, email)
				: undefined;
			if (!email || !user) {
				return reply
					.code(401)
					.send({ error: "That link has expired. Ask for a fresh one." });
			}
			const verdict = await canCompleteChallenge(db, user, "email_link", {
				mode,
			});
			if (!verdict.ok) {
				return reply
					.code(401)
					.send({ error: "That link has expired. Ask for a fresh one." });
			}
			// First-use: persist the method so subsequent sign-ins succeed.
			const own = await getUserMethod(db, user.id, "email_link");
			if (!own) {
				await upsertUserMethod(db, user.id, "email_link", {});
			}
			// Holding the link proves the inbox — stamp verification.
			if (user.email === email && user.email_verified_at === null) {
				await db
					.updateTable("users")
					.set({ email_verified_at: new Date() })
					.where("id", "=", user.id)
					.execute();
			}
			await startSession(fastify, reply, db, user.id, "email_link");
			return reply.redirect("/");
		});
	}

	/* ----------------------------- phone_otp ------------------------------ */

	if (phoneModes) {
		fastify.post("/auth/otp", PUBLIC, async (request, reply) => {
			const body = request.body as { phone?: string };
			const phone = body.phone?.trim();
			if (!phone) return { ok: true };
			const user = await findUserByLoginIdentifier(db, mode, phone);
			const offer = await canOfferChallenge(db, "phone_otp", { mode });
			if (!offer.ok) return { ok: true };
			if (user) {
				const own = await getUserMethod(db, user.id, "phone_otp");
				if (own && !own.enabled) return { ok: true };
			}
			const code = await issueCode(db, phone, "login", "otp", OTP_TTL_MS);
			await fastify.texter.send({
				to: phone,
				text: `Your twodb code: ${code}. It works once, for 10 minutes.`,
			});
			return { ok: true };
		});

		fastify.post("/auth/otp/confirm", PUBLIC, async (request, reply) => {
			const body = request.body as { phone?: string; code?: string };
			const phone = body.phone?.trim();
			const code = body.code?.trim();
			if (!phone || !code) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const ok = await consumeCode(db, phone, "login", code);
			const user = ok
				? await findUserByLoginIdentifier(db, mode, phone)
				: undefined;
			if (!ok || !user) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const verdict = await canCompleteChallenge(db, user, "phone_otp", {
				mode,
			});
			if (!verdict.ok) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const own = await getUserMethod(db, user.id, "phone_otp");
			if (!own) {
				await upsertUserMethod(db, user.id, "phone_otp", {});
			}
			if (user.phone === phone && user.phone_verified_at === null) {
				await db
					.updateTable("users")
					.set({ phone_verified_at: new Date() })
					.where("id", "=", user.id)
					.execute();
			}
			await startSession(fastify, reply, db, user.id, "phone_otp");
			return { principal: await principalFor(db, user.id) };
		});
	}

	/* ---------------------------- verification ---------------------------- */

	fastify.post("/auth/verify", VERIFY_EXEMPT, async (request, reply) => {
		const { userId } = request.principal as Principal;
		const body = request.body as { identifier?: string };
		const identifier = body.identifier?.trim().toLowerCase();
		const user = await db
			.selectFrom("users")
			.select(["email", "phone"])
			.where("id", "=", userId)
			.executeTakeFirst();
		if (!user || (identifier !== user.email && identifier !== user.phone)) {
			return reply
				.code(400)
				.send({ error: "That doesn't match the details on your account." });
		}
		if (identifier === user.email) {
			const code = await issueCode(db, identifier, "verify", "otp", LINK_TTL_MS);
			await fastify.mailer.send({
				to: identifier,
				subject: "Your twodb verification code",
				text: `Your twodb verification code: ${code}. It works once, for 15 minutes.`,
			});
		} else {
			const code = await issueCode(db, identifier, "verify", "otp", OTP_TTL_MS);
			await fastify.texter.send({
				to: identifier,
				text: `Your twodb verification code: ${code}. It works once, for 10 minutes.`,
			});
		}
		return { ok: true };
	});

	fastify.post(
		"/auth/verify/confirm",
		VERIFY_EXEMPT,
		async (request, reply) => {
			const { userId } = request.principal as Principal;
			const body = request.body as { identifier?: string; code?: string };
			const identifier = body.identifier?.trim().toLowerCase();
			const code = body.code?.trim();
			if (!identifier || !code) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const ok = await consumeCode(db, identifier, "verify", code);
			if (!ok) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const user = await db
				.selectFrom("users")
				.select(["email", "phone"])
				.where("id", "=", userId)
				.executeTakeFirst();
			if (user?.email === identifier) {
				await db
					.updateTable("users")
					.set({ email_verified_at: new Date() })
					.where("id", "=", userId)
					.execute();
			} else if (user?.phone === identifier) {
				await db
					.updateTable("users")
					.set({ phone_verified_at: new Date() })
					.where("id", "=", userId)
					.execute();
			}
			return { ok: true };
		},
	);
}
