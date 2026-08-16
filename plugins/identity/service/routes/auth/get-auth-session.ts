import type { FastifyInstance } from "fastify";
import { VERIFY_EXEMPT } from "../../../shared/constants";

export function registerGetAuthSession(fastify: FastifyInstance): void {
	fastify.get("/auth/session", VERIFY_EXEMPT, async (request) => {
		return { principal: request.principal };
	});
}
