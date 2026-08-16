import type { FastifyInstance } from "fastify";
import { PUBLIC_SESSION } from "../../../shared/constants";

export function registerGetAuthSession(fastify: FastifyInstance): void {
	fastify.get("/auth/session", PUBLIC_SESSION, async (request) => {
		return { principal: request.principal };
	});
}
