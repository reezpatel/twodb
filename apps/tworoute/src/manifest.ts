import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";
import { PROVIDERS } from "./providers/catalog.js";

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

const providerField = z.object({
  key: z.string(),
  label: z.string(),
  secret: z.boolean().optional(),
  optional: z.boolean().optional(),
  placeholder: z.string().optional(),
});

const providerSpec = z.object({
  id: z.string(),
  label: z.string(),
  fields: z.array(providerField),
  api: z.enum(["anthropic", "openai", "responses"]),
  auth: z.enum(["x-api-key", "bearer", "claude-oauth", "codex-oauth"]),
  authKey: z.string().optional(),
  defaultBaseUrl: z.string().optional(),
  models: z.array(z.string()),
});

const quotaSnapshot = z.object({
  id: z.string(),
  connectionId: z.string(),
  quotaType: z.string(),
  groupName: z.string(),
  unit: z.string(),
  quotaTotal: z.number().nullable(),
  quotaUsed: z.number(),
  capturedAt: z.string(),
  resetAt: z.string().nullable(),
});

const cachedModel = z.object({
  modelId: z.string(),
  displayName: z.string().nullable(),
  contextWindow: z.number().nullable(),
  thinking: z.boolean(),
  input: z.array(z.string()),
  thinkingLevel: z.array(z.string()),
  temperature: z.boolean(),
  limitContext: z.number().nullable(),
  limitInput: z.number().nullable(),
  limitOutput: z.number().nullable(),
  costInput: z.number().nullable(),
  costOutput: z.number().nullable(),
  costCacheRead: z.number().nullable(),
  output: z.array(z.string()),
});

const listProviders = defineEndpoint({
  name: "listProviders",
  method: "GET",
  path: "/providers",
  auth: "session-or-apiKey",
  description:
    "The provider catalog: 24 providers with their form fields (which are secret/optional), auth style, " +
    "wire protocol, default base URL, and static fallback model lists. The UI builds its add-connection " +
    "form entirely from this.",
  response: z.array(providerSpec),
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
    "(that's how the CLI/tests address connections). Secrets (api key, OAuth tokens, extra config) are " +
    "encrypted at rest (AES-256-GCM). On create the model cache is seeded right away (static fallback " +
    "if the provider's listing API fails).",
  request: z.object({
    spaceId: z.string(),
    name: z.string(),
    provider: z.string(),
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    defaultModel: z.string().optional(),
    config: z.record(z.string(), z.string()).optional(),
  }),
  response: z.object({ id: z.string() }),
});

const updateConnection = defineEndpoint({
  name: "updateConnection",
  method: "PATCH",
  path: "/connections/:id",
  auth: "session-or-apiKey",
  description:
    "Updates a connection — rename, move space, change base URL/default model, rotate the API key, or " +
    "replace its config (OAuth tokens, org, accountId…). Only fields present are changed.",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    spaceId: z.string().optional(),
    baseUrl: z.string().optional(),
    defaultModel: z.string().nullable().optional(),
    apiKey: z.string().optional(),
    config: z.record(z.string(), z.string()).optional(),
  }),
  response: z.object({ ok: z.literal(true) }),
});

const deleteConnection = defineEndpoint({
  name: "deleteConnection",
  method: "DELETE",
  path: "/connections/:id",
  auth: "session-or-apiKey",
  description: "Deletes a connection, its cached models, and its quota snapshots. Usage history is kept (soft reference by id).",
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
    "(validating the key in the process), else falls back to a minimal 1-token completion. OAuth connections " +
    "get their access token refreshed first.",
  request: z.object({ id: z.string() }),
  response: z.object({
    ok: z.boolean(),
    via: z.enum(["models", "completion"]),
    modelCount: z.number().nullable().optional(),
  }),
});

const listModels = defineEndpoint({
  name: "listModels",
  method: "GET",
  path: "/connections/:id/models",
  auth: "session-or-apiKey",
  description:
    "Lists a connection's cached models — refreshed from the provider when possible, enriched with " +
    "models.dev metadata (context window, costs, modalities, thinking levels), falling back to the " +
    "provider's static list. POST refresh-models re-populates the cache.",
  request: z.object({ id: z.string() }),
  response: z.object({ models: z.array(cachedModel) }),
});

const refreshModels = defineEndpoint({
  name: "refreshModels",
  method: "POST",
  path: "/connections/:id/refresh-models",
  auth: "session-or-apiKey",
  description:
    "Re-fetches a connection's model list from the provider (or its static catalog when there's no listing " +
    "API), enriches with models.dev metadata, and replaces the cache. Returns count + any warnings.",
  request: z.object({ id: z.string() }),
  response: z.object({ count: z.number(), warning: z.string().optional() }),
});

const listQuotas = defineEndpoint({
  name: "listQuotas",
  method: "GET",
  path: "/quotas",
  auth: "session-or-apiKey",
  description:
    "All quota snapshots for the workspace, joined per connection — provider usage windows (5h/weekly " +
    "percentages, credits, token counts) as last captured.",
  response: z.object({ quotas: z.array(quotaSnapshot) }),
});

const listConnectionQuotas = defineEndpoint({
  name: "listConnectionQuotas",
  method: "GET",
  path: "/connections/:id/quotas",
  auth: "session-or-apiKey",
  description: "One connection's quota snapshots, ordered by type.",
  request: z.object({ id: z.string() }),
  response: z.object({ quotas: z.array(quotaSnapshot) }),
});

const refreshQuotas = defineEndpoint({
  name: "refreshQuotas",
  method: "POST",
  path: "/connections/:id/refresh-quotas",
  auth: "session-or-apiKey",
  description:
    "Fetches fresh quota snapshots from the provider's usage API (claude-code, codex, zai, kimi, " +
    "ollama-cloud, minimax, kilo-code, cline have collectors) and replaces the cached windows.",
  request: z.object({ id: z.string() }),
  response: z.object({ quotas: z.array(quotaSnapshot) }),
});

const getConnectionUsage = defineEndpoint({
  name: "getConnectionUsage",
  method: "GET",
  path: "/connections/:id/usage",
  auth: "session-or-apiKey",
  description: "Per-connection usage totals: request count, token sums, last-used time (from the usage log).",
  request: z.object({ id: z.string() }),
  response: z.object({
    requests: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    lastUsedAt: z.string().nullable(),
  }),
});

const analyticsSummary = defineEndpoint({
  name: "analyticsSummary",
  method: "GET",
  path: "/analytics/summary",
  auth: "session-or-apiKey",
  description:
    "24h usage summary (default ?days=1) per (connection, model): calls with completed/failed split, " +
    "input/output token sums, and avg/p95 latency — one usage_log query feeds every dashboard widget. " +
    "Cost is derived client-side from cached model prices. Optional ?connectionId= scopes to one connection.",
  request: z.object({ days: z.string().optional(), connectionId: z.string().optional() }),
  response: z.object({
    since: z.string(),
    days: z.number(),
    rows: z.array(
      z.object({
        connectionId: z.string(),
        model: z.string(),
        calls: z.number(),
        completed: z.number(),
        failed: z.number(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        avgLatencyMs: z.number().nullable(),
        p95LatencyMs: z.number().nullable(),
      }),
    ),
  }),
});

const analyticsCalls = defineEndpoint({
  name: "analyticsCalls",
  method: "GET",
  path: "/analytics/calls",
  auth: "session-or-apiKey",
  description:
    "Call analytics as daily buckets (date_trunc day) per connection, up to 365 days back — feeds the " +
    "dashboard's Calls widget yearly view, with completed/failed split per day. Optional ?connectionId= scopes " +
    "to one connection. " +
    "Days without calls return no bucket — clients fill the gaps.",
  request: z.object({ days: z.string().optional(), connectionId: z.string().optional() }),
  response: z.object({
    since: z.string(),
    days: z.number(),
    buckets: z.array(
      z.object({ connectionId: z.string(), day: z.string(), calls: z.number(), completed: z.number(), failed: z.number() }),
    ),
  }),
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

const analyticsTools = defineEndpoint({
  name: "analyticsTools",
  method: "GET",
  path: "/analytics/tools",
  auth: "session-or-apiKey",
  description:
    "Tool invocations grouped per tool name over the window (default 24h): calls + completed/failed split. " +
    "Rows come from assistant-chosen tool_calls parsed out of completion responses, and direct " +
    "POST /tools/invoke logs.",
  request: z.object({ days: z.string().optional(), connectionId: z.string().optional() }),
  response: z.object({
    since: z.string(),
    days: z.number(),
    tools: z.array(z.object({ name: z.string(), calls: z.number(), completed: z.number(), failed: z.number() })),
  }),
});

const toolInvoke = defineEndpoint({
  name: "toolInvoke",
  method: "POST",
  path: "/tools/invoke",
  auth: "session-or-apiKey",
  description:
    "Logs one tool invocation against a connection (the app executes the tool itself; this records the " +
    "fact). Sets the usage row's tool_name so /analytics/tools picks it up.",
  request: z.object({
    connectionId: z.string().optional(),
    connectionName: z.string().optional(),
    tool: z.string(),
    status: z.enum(["ok", "error"]).optional(),
    latencyMs: z.number().optional(),
  }),
  response: z.object({ ok: z.literal(true) }),
});

const oauthStart = (provider: "claude-code" | "codex") =>
  defineEndpoint({
    name: `oauth${provider === "codex" ? "Codex" : "ClaudeCode"}Start`,
    method: "POST",
    path: `/oauth/${provider}/start`,
    auth: "session-or-apiKey",
    description:
      `Starts the ${provider === "codex" ? "ChatGPT/Codex" : "Claude Code"} OAuth PKCE flow: spins up a one-shot ` +
      "local callback listener and returns the browser authorize URL. Poll with /poll until done; if the " +
      "local callback is unreachable (firewalled browser), /complete accepts the pasted callback URL.",
    response: z.object({ url: z.string(), state: z.string() }),
  });

const oauthPoll = (provider: "claude-code" | "codex") =>
  defineEndpoint({
    name: `oauth${provider === "codex" ? "Codex" : "ClaudeCode"}Poll`,
    method: "POST",
    path: `/oauth/${provider}/poll`,
    auth: "session-or-apiKey",
    description:
      "Polls an OAuth flow started with /start. pending → done (tokens) | error. Once done, save the " +
      "refresh/access tokens on the connection's config.",
    request: z.object({ state: z.string() }),
    response: z.object({ status: z.enum(["pending", "done", "error", "unknown"]) }).passthrough(),
  });

const oauthComplete = (provider: "claude-code" | "codex") =>
  defineEndpoint({
    name: `oauth${provider === "codex" ? "Codex" : "ClaudeCode"}Complete`,
    method: "POST",
    path: `/oauth/${provider}/complete`,
    auth: "session-or-apiKey",
    description:
      "Manual OAuth completion for firewalled local callbacks: accepts the pasted callback URL (or " +
      '"code state" pair) instead of the local listener.',
    request: z.object({ input: z.string() }),
    response: z.object({ status: z.string() }).passthrough(),
  });

const completions = defineEndpoint({
  name: "completions",
  method: "POST",
  path: "/completions",
  auth: "session-or-apiKey",
  streaming: true,
  description:
    "OpenAI-compatible chat completions (anthropic/responses wires translated per provider). Pick a " +
    "connection via `connectionId`, `connectionName` (unique per workspace — handy for CLI/tests), or the " +
    "first visible in-scope if both are omitted. Non-streaming requests get a plain JSON response and are " +
    "usage-logged; `stream: true` is a raw pass-through. OAuth-backed providers (claude-code, codex) get " +
    "their access token refreshed automatically when stale. Any external tool (e.g. Cursor) can point at " +
    "this with a workspace API key, same as an internal app.",
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

const transcriptions = defineEndpoint({
  name: "transcriptions",
  method: "POST",
  path: "/audio/transcriptions",
  auth: "session-or-apiKey",
  description:
    "OpenAI-compatible audio transcription (Whisper & friends). The multipart form-data body passes " +
    "through untouched to the picked connection's base_url — any provider wire is allowed; an upstream " +
    "without a transcription API returns its own error. Pick the connection via `?connectionId=` or " +
    "`?connectionName=` query params (first visible in-scope otherwise). Also served at " +
    "/v1/audio/transcriptions for stock OpenAI SDK clients.",
  request: z.object({ connectionId: z.string().optional(), connectionName: z.string().optional() }),
  response: z.object({ text: z.string().optional() }).passthrough(),
});

const openaiCompatChat = defineEndpoint({
  name: "openaiCompatChat",
  method: "POST",
  path: "/v1/chat/completions",
  auth: "session-or-apiKey",
  streaming: true,
  description:
    "OpenAI path-shape alias of POST /completions — same handler. Point any stock OpenAI SDK client " +
    "(openai npm pkg, Cursor, Continue…) at {gateway}/apps/tworoute/v1 with a TwoDB workspace API key " +
    "as the apiKey; the gateway accepts workspace keys in the Authorization: Bearer slot too. A model id " +
    "of the form \"<connection-name>/<model-id>\" (as returned by GET /v1/models) targets that connection " +
    "specifically; a bare model name uses the first visible connection (or explicit connectionId/connectionName).",
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

const openaiCompatModels = defineEndpoint({
  name: "openaiCompatModels",
  method: "GET",
  path: "/v1/models",
  auth: "session-or-apiKey",
  description:
    "OpenAI list-shape model catalog aggregated across ALL visible connections. Each id is " +
    "\"<connection-name>/<model-id>\" (e.g. \"kilo/anthropic/claude-opus-4.8\", \"openai/gpt-5.2\") — use that id " +
    "as the model in /v1/chat/completions to target the connection. Beyond the standard fields (id, object, " +
    "created, owned_by) each entry carries connection_name, provider, display_name, context_window, thinking, " +
    "input/output modalities, temperature support, max input/output tokens, and per-million costs (cached from " +
    "the provider, enriched via models.dev).",
  response: z.object({
    object: z.literal("list"),
    data: z.array(z.object({ id: z.string(), object: z.literal("model"), created: z.number(), owned_by: z.string() }).passthrough()),
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

void PROVIDERS; // catalog module is self-contained; import kept for locality of the schemas above

export const tworouteManifest = defineAppManifest({
  name: "TwoRoute",
  slug: "tworoute",
  version: "0.1.0",
  shape: "backend",
  description:
    "Multi-provider LLM gateway: 24 provider kinds (OAuth for Claude Code & Codex included), space-scoped " +
    "connections with secrets encrypted at rest, model caching enriched from models.dev, provider quota " +
    "tracking, streaming OpenAI-compatible /completions, and token-usage logging.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/tworoute",
  endpoints: [
    listProviders,
    listConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    listModels,
    refreshModels,
    listQuotas,
    listConnectionQuotas,
    refreshQuotas,
    getConnectionUsage,
    getUsage,
    analyticsSummary,
    analyticsCalls,
    analyticsTools,
    toolInvoke,
    oauthStart("claude-code"),
    oauthPoll("claude-code"),
    oauthComplete("claude-code"),
    oauthStart("codex"),
    oauthPoll("codex"),
    oauthComplete("codex"),
    completions,
    transcriptions,
    openaiCompatChat,
    openaiCompatModels,
    internalManifest,
  ],
});

export default tworouteManifest;
