import type { FastifyInstance } from "fastify";
import { requireSuperadmin } from "../../lib/admin/admin";

export function adminGate(fastify: FastifyInstance) {
	return requireSuperadmin(fastify);
}
