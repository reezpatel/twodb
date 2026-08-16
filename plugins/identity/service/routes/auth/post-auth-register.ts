import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { IdentifierMode } from "../../db/schema";
import type { AuthCtx } from "../../lib/auth/ctx";
import { getDeploymentMethod, upsertUserMethod } from "../../lib/users/methods";
import { hashPassword } from "../../lib/auth/passwords";
import { startSession } from "../../lib/auth/signin";
import { PUBLIC } from "../../../shared/constants";
import { maybeSeedSuperadmin } from "../../lib/auth/superadmin";

interface CredentialsBody {
	name?: string;
	email?: string;
	phone?: string;
	password?: string;
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function validateCredentials(
	mode: IdentifierMode,
	body: CredentialsBody,
): { email: string | null; phone: string | null } | string {
	const email = body.email?.trim() ? normalizeEmail(body.email) : null;
	const phone = body.phone?.trim() || null;
	if (!body.password || body.password.length < 8) {
		return "Password needs at least 8 characters.";
	}
	if ((mode === "email" || mode === "email+phone") && !email) {
		return "An email address is required.";
	}
	if ((mode === "phone" || mode === "email+phone") && !phone) {
		return "A phone number is required.";
	}
	if (mode === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) {
		return "That doesn't look like an email address.";
	}
	return { email, phone };
}

export function registerPostAuthRegister(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode } = ctx;

	fastify.post("/auth/register", PUBLIC, async (request, reply) => {
		const body = request.body as CredentialsBody;
		const parsed = validateCredentials(mode, body);
		if (typeof parsed === "string") {
			return reply.code(400).send({ error: parsed });
		}
		if (!body.name?.trim()) {
			return reply.code(400).send({ error: "Your name is required." });
		}
		const passwordOffered = await getDeploymentMethod(db, "password");
		if (!passwordOffered?.enabled) {
			return reply.code(403).send({
				error: "Password sign-in is turned off on this server.",
			});
		}

		// One login key regardless of mode: email in the email modes, phone in
		// phone mode. The schema never bakes in the deployment mode, so the
		// mode can change without a migration.
		const identifier = mode === "phone" ? parsed.phone! : parsed.email!;
		if (mode === "email+phone" && parsed.phone) {
			const phoneTaken = await db
				.selectFrom("users")
				.select("id")
				.where("phone", "=", parsed.phone)
				.executeTakeFirst();
			if (phoneTaken) {
				return reply
					.code(409)
					.send({ error: "An account with these details already exists." });
			}
		}

		const userId = newId("usr");
		try {
			await db
				.insertInto("users")
				.values({
					id: userId,
					identifier,
					name: body.name.trim(),
					email: parsed.email,
					phone: parsed.phone,
				})
				.execute();
			await upsertUserMethod(db, userId, "password", {
				hash: await hashPassword(body.password!),
			});
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				return reply
					.code(409)
					.send({ error: "An account with these details already exists." });
			}
			throw err;
		}

		fastify.bus.emit("twodb.identity.user.created", { userId });
		await maybeSeedSuperadmin(db, fastify, ctx.superadminEmail);
		await startSession(fastify, reply, db, userId, "password");
		return reply.code(201).send({ principal: { userId, isSuperadmin: false } });
	});
}
