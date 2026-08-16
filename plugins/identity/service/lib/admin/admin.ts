import { identityDb } from "../../db";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";


/**
 * Admin helpers (task-08 §8.2 + §8.5).
 *
 * `requireSuperadmin` is a preHandler exported by the identity plugin
 * and decorated onto fastify for symmetry with the authz engine's
 * factories.
 *
 * `audit(...)` writes the audit_log row + emits the matching bus fact.
 * Payloads are redacted against a small secrets blacklist before
 * landing in either store (task-08 §8.5 "no plaintext secrets").
 */

const SENSITIVE_KEYS = new Set([
	"client_secret",
	"smtp_password",
	"sms_token",
	"password",
	"clientsecret",
]);

export type RequireSuperadminHook = (
	request: import("fastify").FastifyRequest,
	reply: import("fastify").FastifyReply,
) => Promise<void> | void;

export function requireSuperadmin(
	fastify: FastifyInstance,
): RequireSuperadminHook {
	return async (request, reply) => {
		if (!request.principal?.isSuperadmin) {
			return reply.code(403).send({
				error: "Only a superadmin can do that.",
			});
		}
	};
}

export async function audit(
	fastify: FastifyInstance,
	args: {
		actor: string;
		action: string;
		target: string;
		payload?: Record<string, unknown>;
	},
): Promise<void> {
	const db = identityDb(fastify);
	const id = `aud-${randomBytes(8).toString("base64url")}`;
	const safe = redact(args.payload ?? {});
	await db
		.insertInto("audit_log")
		.values({
			id,
			actor: args.actor,
			action: args.action,
			target: args.target,
			payload: safe,
		})
		.execute();
	fastify.bus.emit(
		"twodb.identity.admin.action" as never,
		{
			id,
			actor: args.actor,
			action: args.action,
			target: args.target,
		} as never,
	);
}

function redact(value: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) {
		if (SENSITIVE_KEYS.has(k.toLowerCase())) {
			out[k] = "••••";
			continue;
		}
		if (v && typeof v === "object" && !Array.isArray(v)) {
			out[k] = redact(v as Record<string, unknown>);
		} else {
			out[k] = v;
		}
	}
	return out;
}

export function maskConfigSecrets<T extends Record<string, unknown>>(
	config: T,
): T {
	const out = { ...config };
	for (const k of Object.keys(out)) {
		if (SENSITIVE_KEYS.has(k.toLowerCase())) {
			(out as Record<string, unknown>)[k] = "••••";
		}
	}
	return out;
}
