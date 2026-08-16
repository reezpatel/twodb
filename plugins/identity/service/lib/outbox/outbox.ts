import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

/**
 * Outbound channels behind a tiny interface. Dev driver: the server log —
 * links and codes appear there, readable in `pnpm start` output. Real
 * providers are superadmin config (task 8).
 */
export interface Mailer {
	send(msg: { to: string; subject: string; text: string }): Promise<void>;
}

export interface Texter {
	send(msg: { to: string; text: string }): Promise<void>;
}

declare module "fastify" {
	interface FastifyInstance {
		mailer: Mailer;
		texter: Texter;
	}
}

export const outboxPlugin = fp(async (fastify: FastifyInstance) => {
	fastify.decorate("mailer", {
		async send({ to, subject, text }) {
			fastify.log.info({ to, subject, text }, "mailer (console driver)");
		},
	} satisfies Mailer);
	fastify.decorate("texter", {
		async send({ to, text }) {
			fastify.log.info({ to, text }, "texter (console driver)");
		},
	} satisfies Texter);
}, { name: "twodb-identity-outbox" });
