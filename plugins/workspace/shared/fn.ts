import type {} from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    workspaceId: string | null;
  }
}

declare module "@twodb/shared-backend" {
  interface TwodbFn {
    "workspace.owns": (input: { workspaceId: string; userId: string }) => Promise<boolean>;
  }
}
