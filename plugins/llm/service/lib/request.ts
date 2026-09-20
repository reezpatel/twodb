import type { FastifyReply, FastifyRequest } from "fastify";
import type {} from "@fastify/cookie";
import type {} from "@twodb/workspace/shared/fn";
import type { Kysely } from "kysely";
import type { LlmDb, SelectedConnection } from "../db";
import type { RouteDeps } from "./types";

export type Scope = { deps: RouteDeps; workspaceId: string };

export async function scope(deps: RouteDeps, request: FastifyRequest, reply: FastifyReply): Promise<Scope | null> {
  const workspaceId = request.workspaceId;
  if (!workspaceId) {
    reply.code(400).send({ error: "workspace_required" });
    return null;
  }
  return { deps, workspaceId };
}

export async function loadConnection(kysely: Kysely<LlmDb>, connectionId: string, workspaceId: string): Promise<SelectedConnection | null> {
  return kysely.selectFrom("llm_connections").selectAll().where("id", "=", connectionId).where("workspace_id", "=", workspaceId).executeTakeFirst() ?? null;
}
