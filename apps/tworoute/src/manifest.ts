import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

const chatMessage = z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() });

const listConnections = defineEndpoint({
  name: "listConnections",
  method: "GET",
  path: "/connections",
  auth: "session",
  description: "Lists LLM provider connections visible to the caller's active spaces.",
  response: z.array(
    z.object({ id: z.string(), name: z.string(), provider: z.string(), default_model: z.string().nullable() }),
  ),
});

const createConnection = defineEndpoint({
  name: "createConnection",
  method: "POST",
  path: "/connections",
  auth: "session",
  description: "Registers a new LLM provider connection, scoped to one space.",
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

const completions = defineEndpoint({
  name: "completions",
  method: "POST",
  path: "/completions",
  auth: "session-or-apiKey",
  streaming: true,
  description:
    "OpenAI-compatible chat completions endpoint. Pick a connection via `connectionId`, or the first " +
    "connection visible in-scope if omitted. Any external tool (e.g. Cursor) can point at this using a " +
    "workspace API key, same as an internal app would.",
  request: z.object({
    connectionId: z.string().optional(),
    model: z.string(),
    messages: z.array(chatMessage),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
  }),
});

export const tworouteManifest = defineAppManifest({
  name: "TwoRoute",
  slug: "tworoute",
  version: "0.1.0",
  shape: "backend",
  description:
    "Multi-provider LLM gateway: Space-scoped provider connections plus a streaming OpenAI-compatible " +
    "/completions endpoint any app — or any external tool with a workspace API key — can call.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform"],
  basePath: "/apps/tworoute",
  endpoints: [listConnections, createConnection, completions],
});

export default tworouteManifest;
