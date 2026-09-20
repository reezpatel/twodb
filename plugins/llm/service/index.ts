import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type { TwodbCompletionRequest, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbStreamEvent } from "@twodb/contracts";
import type {} from "../shared/fn";
import { adapters } from "./adapters";
import { llmMigrations, readSettings, type LlmDb, type SelectedConnection } from "./db";
import { registerRoutes } from "./routes";
import { coerceGovernance } from "./settings";
import { acquire } from "./governor";

let db: Kysely<LlmDb> | null = null;

const requireDb = (): Kysely<LlmDb> => {
  if (!db) throw new Error("llm plugin not initialized");
  return db;
};

const resolveConnection = async (workspaceId: string, connectionId: string | null | undefined): Promise<SelectedConnection | null> => {
  const kysely = requireDb();
  if (connectionId) {
    return (
      (await kysely.selectFrom("llm_connections").selectAll().where("id", "=", connectionId).where("workspace_id", "=", workspaceId).executeTakeFirst()) ?? null
    );
  }

  const settings = await readSettings(kysely, workspaceId);
  if (settings.default_model?.provider) {
    const byProvider = await kysely
      .selectFrom("llm_connections")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("provider", "=", settings.default_model.provider)
      .where("enabled", "=", true)
      .orderBy("created_at")
      .limit(1)
      .execute();
    if (byProvider[0]) return byProvider[0] as SelectedConnection;
  }

  const anyEnabled = await kysely
    .selectFrom("llm_connections")
    .selectAll()
    .where("workspace_id", "=", workspaceId)
    .where("enabled", "=", true)
    .orderBy("created_at")
    .limit(1)
    .execute();
  return (anyEnabled[0] as SelectedConnection | undefined) ?? null;
};

const LlmServicePlugin = {
  init: async (ctx: TwodbContext, app: FastifyInstance) => {
    db = ctx.db as unknown as Kysely<LlmDb>;
    await registerRoutes(ctx, app);
  },
  functions: {
    "llm.register": (adapter: TwodbLlmProviderAdapter) => {
      adapters.set(adapter.providerId, adapter);
    },
    "llm.adapters": () => [...adapters.values()],
    "llm.adapter": (providerId: string) => adapters.get(providerId) ?? null,

    "llm.complete": async (input: { workspaceId: string; connectionId?: string | null; request: TwodbCompletionRequest }): Promise<TwodbCompletionResponse> => {
      const connection = await resolveConnection(input.workspaceId, input.connectionId);
      if (!connection) throw new Error("no_llm_connection");

      const adapter = adapters.get(connection.provider) ?? null;
      if (!adapter) throw new Error(`provider_adapter_missing:${connection.provider}`);

      const settings = await readSettings(requireDb(), input.workspaceId);
      const governance = coerceGovernance((connection.overrides as { governance?: unknown } | null)?.governance) ?? {};
      const lease = await acquire(connection.id, governance, settings.queue.max_wait_ms);
      if (!lease.ok) {
        throw new Error(`limit_exceeded:${lease.reason}`);
      }

      try {
        const response = await adapter.completions.complete(input.request, {
          connectionId: connection.id,
          config: connection.config ?? {},
        });
        lease.addUsage(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0);
        return response;
      } finally {
        lease.release();
      }
    },

    "llm.stream": async (input: {
      workspaceId: string;
      connectionId?: string | null;
      request: TwodbCompletionRequest;
    }): Promise<AsyncIterable<TwodbStreamEvent>> => {
      const connection = await resolveConnection(input.workspaceId, input.connectionId);
      if (!connection) throw new Error("no_llm_connection");

      const adapter = adapters.get(connection.provider) ?? null;
      if (!adapter) throw new Error(`provider_adapter_missing:${connection.provider}`);

      const settings = await readSettings(requireDb(), input.workspaceId);
      const governance = coerceGovernance((connection.overrides as { governance?: unknown } | null)?.governance) ?? {};
      const lease = await acquire(connection.id, governance, settings.queue.max_wait_ms);
      if (!lease.ok) {
        throw new Error(`limit_exceeded:${lease.reason}`);
      }

      const events = adapter.completions.stream(input.request, {
        connectionId: connection.id,
        config: connection.config ?? {},
      });

      return (async function* () {
        try {
          for await (const event of events) {
            if (event.type === "usage") {
              lease.addUsage(event.usage.input_tokens, event.usage.output_tokens);
            }
            yield event;
          }
        } finally {
          lease.release();
        }
      })();
    },
  },
  migrations: llmMigrations,
} satisfies ServicePlugin;

export default LlmServicePlugin;
