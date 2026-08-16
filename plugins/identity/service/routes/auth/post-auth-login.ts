import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import {
	explainSignIn,
	findUserByLoginIdentifier,
	getUserMethod,
} from "../../lib/users/methods";
import { verifyPassword } from "../../lib/auth/passwords";
import { principalFor, startSession } from "../../lib/auth/signin";
import { PUBLIC } from "../../../shared/constants";

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function registerPostAuthLogin(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db, mode, requireVerified } = ctx;

	fastify.post("/auth/login", PUBLIC, async (request, reply) => {
		const body = request.body as {
			email?: string;
			phone?: string;
			password?: string;
		};
		const identifier = body.email?.trim()
			? normalizeEmail(body.email)
			: (body.phone?.trim() ?? "");
		const generic = () =>
			reply.code(401).send({ error: "Those sign-in details don't match." });

		const user = identifier
			? await findUserByLoginIdentifier(db, mode, identifier)
			: undefined;
		if (!user) return generic();

		const verdict = await explainSignIn(db, user, "password", {
			mode,
			requireVerified,
		});
		if (!verdict.ok) {
			if (verdict.reason === "verify_required") {
				return reply.code(403).send({ error: "verify_required" });
			}
			return generic();
		}

		const method = await getUserMethod(db, user.id, "password");
		const hash = method?.credential.hash;
		if (!hash || !(await verifyPassword(body.password ?? "", hash))) {
			return generic();
		}

		await startSession(fastify, reply, db, user.id, "password");
		return {
			principal: request.principal ?? (await principalFor(db, user.id)),
		};
	});
}
