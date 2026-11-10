import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

const chatMessage = z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() });

const connectionSummary = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  provider: z.string(),
  baseUrl: z.string(),
  defaultModel: z.string().nullable(),
  createdAt: z.string(),
});

const listConnections = defineEndpoint({
  name: "listConnections",
  method: "GET",
  path: "/connections",
  auth: "session-or-apiKey",
  description: "Lists LLM provider connections visible to the caller's active spaces. API keys are never returned — not even encrypted.",
  response: z.array(connectionSummary),
});

const createConnection = defineEndpoint({
  name: "createConnection",
  method: "POST",
  path: "/connections",
  auth: "session-or-apiKey",
  description:
    "Registers a new LLM provider connection, scoped to one space. `name` is unique per workspace " +
    "(that's how the CLI/tests address connections). The API key is encrypted at rest (AES-256-GCM).",
  request: z.object({
    spaceId: z.string(),
    name: z.string(),
    provider: z.enum(["openai-compatible", "anthropic"]),
    baseUrl: z.string(),
    apiKey: z.string(),
    defaultModel: z.string().optional(),
  }),
  response: z.object({ id: z.string() }),
});

const updateConnection = defineEndpoint({
  name: "updateConnection",
  method: "PATCH",
  path: "/connections/:id",
  auth: "session-or-apiKey",
  description: "Updates a connection's name/base URL/default model, or rotates its API key (only fields present are changed).",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    baseUrl: z.string().optional(),
    defaultModel: z.string().nullable().optional(),
    apiKey: z.string().optional(),
  }),
  response: z.object({ ok: z.literal(true) }),
});

const deleteConnection = defineEndpoint({
  name: "deleteConnection",
  method: "DELETE",
  path: "/connections/:id",
  auth: "session-or-apiKey",
  description: "Deletes a connection. Usage history is kept (it references the connection by id).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.literal(true) }),
});

const testConnection = defineEndpoint({
  name: "testConnection",
  method: "POST",
  path: "/connections/:id/test",
  auth: "session-or-apiKey",
  description:
    "Smoke-tests a connection without burning a real completion: lists models when the provider supports it " +
    "(validating the key in the process), else falls back to a minimal 1-token completion.",
  request: z.object({ id: z.string() }),
  response: z.object({
    ok: z.boolean(),
    via: z.enum(["models", "completion"]),
    modelCount: z.number().optional(),
    upstreamStatus: z.number().optional(),
  }),
});

const listModels = defineEndpoint({
  name: "listModels",
  method: "GET",
  path: "/connections/:id/models",
  auth: "session-or-apiKey",
  description:
    "Lists the models a connection can serve (OpenAI's GET /models shape). 422 when the provider has no " +
    "listing API (e.g. Anthropic) — enter a model name manually in that case.",
  request: z.object({ id: z.string() }),
  response: z.object({ models: z.array(z.string()) }),
});

const getUsage = defineEndpoint({
  name: "getUsage",
  method: "GET",
  path: "/usage",
  auth: "session-or-apiKey",
  description:
    "Token-usage summary per connection+model over the last N days (?days=7, max 90). Only non-streaming " +
    "completions are recorded — streamed requests stay unmeasured in v1 (the SSE token counts would need " +
    "interception; deliberately deferred).",
  request: z.object({ days: z.string().optional() }),
  response: z.object({
    since: z.string(),
    days: z.number(),
    rows: z.array(
      z.object({
        connection_id: z.string(),
        model: z.string(),
        calls: z.unknown(),
        input_tokens: z.unknown(),
        output_tokens: z.unknown(),
      }),
    ),
  }),
});

const completions = defineEndpoint({
  name: "completions",
  method: "POST",
  path: "/completions",
  auth: "session-or-apiKey",
  streaming: true,
  description:
    "OpenAI-compatible chat completions. Pick a connection via `connectionId`, `connectionName` (unique per " +
    "workspace — handy for CLI/tests), or the first visible in-scope if both are omitted. Non-streaming " +
    "requests get a plain JSON response and are usage-logged; `stream: true` is a raw pass-through. Any " +
    "external tool (e.g. Cursor) can point at this with a workspace API key, same as an internal app.",
  request: z.object({
    connectionId: z.string().optional(),
    connectionName: z.string().optional(),
    model: z.string(),
    messages: z.array(chatMessage),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
  }),
});

const internalManifest = defineEndpoint({
  name: "internalManifest",
  method: "GET",
  path: "/internal/manifest",
  auth: "public",
  description:
    "Pull-registration endpoint TwoDB's orchestrator polls on this app's published port after starting its " +
    "container. Guarded by the per-app registration token via the `x-registration-token` header (shared " +
    "contract in core-platform/src/manifest/serve.ts) — not callable through the Gateway.",
  response: z.object({ slug: z.string(), httpUrl: z.string(), manifest: z.unknown() }),
});

export const tworouteManifest = defineAppManifest({
  name: "TwoRoute",
  slug: "tworoute",
  version: "0.1.0",
  shape: "backend",
  description:
    "Multi-provider LLM gateway: Space-scoped provider connections (encrypted at rest), streaming " +
    "OpenAI-compatible /completions, model listing, connection smoke-tests, and token-usage logging.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/tworoute",
  endpoints: [
    listConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    listModels,
    getUsage,
    completions,
    internalManifest,
  ],
});

export default tworouteManifest;
