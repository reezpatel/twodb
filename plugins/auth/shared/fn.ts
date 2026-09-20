import type {} from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId: string | null;
  }
}
