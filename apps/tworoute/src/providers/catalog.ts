/**
 * Provider catalog — ported from the legacy app's llm-providers.ts, adapted to
 * TwoRoute's typed connection shape. Legacy stored a config blob; we store
 * named columns, so `fields` describes the FORM, and `auth`/`api` decide
 * which wire/auth the provider adapters use.
 */

export interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
}

/** Chat wire protocol the provider speaks. */
export type LlmWire = "anthropic" | "openai" | "responses";

/** How requests authenticate. */
export type LlmAuth = "x-api-key" | "bearer" | "claude-oauth" | "codex-oauth";

export interface ProviderSpec {
  id: string;
  label: string;
  fields: ProviderField[];
  api: LlmWire;
  auth: LlmAuth;
  /** Connection field holding the credential for bearer/oauth auth. */
  authKey?: string;
  defaultBaseUrl?: string;
  /** Static fallback model list; live refresh overrides when available. */
  models: string[];
}

const API_KEY: ProviderField = { key: "apiKey", label: "API key", secret: true };
const opt = (field: ProviderField): ProviderField => ({ ...field, optional: true });
const REFRESH_TOKEN: ProviderField = { key: "refreshToken", label: "Refresh token", secret: true };
const ACCESS_TOKEN: ProviderField = { key: "accessToken", label: "Access token", secret: true, placeholder: "filled automatically" };
const BASE_URL: ProviderField = { key: "baseUrl", label: "Base URL" };

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.anthropic.com" })],
    api: "anthropic",
    auth: "x-api-key",
    defaultBaseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5"],
  },
  {
    id: "openai",
    label: "OpenAI",
    fields: [API_KEY, opt({ key: "org", label: "Organization", placeholder: "org-…" }), opt({ ...BASE_URL, placeholder: "https://api.openai.com/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.2", "gpt-5.2-mini", "gpt-5.1"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://openrouter.ai/api/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [],
  },
  {
    id: "google",
    label: "Google Gemini",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://generativelanguage.googleapis.com/v1beta/openai" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    fields: [{ ...BASE_URL, placeholder: "https://api.example.com/v1" }, API_KEY],
    api: "openai",
    auth: "bearer",
    models: [],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    fields: [REFRESH_TOKEN, opt(ACCESS_TOKEN)],
    api: "anthropic",
    auth: "claude-oauth",
    authKey: "accessToken",
    defaultBaseUrl: "https://api.anthropic.com",
    models: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5"],
  },
  {
    id: "codex",
    label: "Codex (OpenAI)",
    fields: [REFRESH_TOKEN, { key: "accountId", label: "Account ID" }, opt(ACCESS_TOKEN)],
    api: "responses",
    auth: "codex-oauth",
    authKey: "accessToken",
    defaultBaseUrl: "https://chatgpt.com/backend-api/codex",
    // chatgpt backend has no model-listing endpoint — this static list IS the catalog
    models: ["gpt-5.5", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-5.3-codex-spark"],
  },
  {
    id: "kimi",
    label: "Kimi for Coding",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.kimi.com/coding" })],
    api: "anthropic",
    auth: "x-api-key",
    defaultBaseUrl: "https://api.kimi.com/coding",
    models: ["kimi-k2-0905-preview", "kimi-k2-turbo-preview", "kimi-latest"],
  },
  {
    id: "moonshot",
    label: "Moonshot (platform)",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.moonshot.ai/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
    models: ["kimi-k2-0905-preview", "kimi-k2-turbo-preview", "kimi-latest"],
  },
  {
    id: "zai",
    label: "GLM (z.ai)",
    fields: [API_KEY],
    // OpenAI wire on the coding-plan endpoint: streams reasoning as
    // reasoning_content; thinking toggled via a param.
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.z.ai/api/coding/paas/v4",
    models: ["glm-4.7", "glm-5-turbo", "glm-5.2", "glm-5.2-highspeed", "glm-5.3", "glm-5.3-flash", "glm-5.3-highspeed"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    fields: [API_KEY],
    api: "anthropic",
    auth: "x-api-key",
    defaultBaseUrl: "https://api.minimax.io/anthropic",
    models: ["minimax-m2", "minimax-m2.1"],
  },
  {
    id: "cline",
    label: "Cline",
    fields: [ACCESS_TOKEN, opt(REFRESH_TOKEN), opt(API_KEY)],
    api: "openai",
    auth: "bearer",
    authKey: "accessToken",
    defaultBaseUrl: "https://api.cline.bot/api/v1",
    models: [
      "~anthropic/claude-sonnet-latest",
      "~anthropic/claude-opus-latest",
      "~openai/gpt-mini-latest",
      "~google/gemini-pro-latest",
      "~z-ai/glm-latest",
      "~moonshotai/kimi-latest",
      "~deepseek/deepseek-pro-latest",
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.2",
      "openai/gpt-5.2-codex",
      "google/gemini-3.5-flash",
      "z-ai/glm-5.3",
      "moonshotai/kimi-k3",
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.8-flash",
      "x-ai/grok-4.7",
      "kwaipilot/kat-coder-pro-v2.5",
    ],
  },
  {
    id: "kilo-code",
    label: "Kilo Code",
    fields: [{ key: "apiKey", label: "API key (app.kilo.ai)", secret: true }, opt({ ...BASE_URL, placeholder: "https://api.kilo.ai/api/gateway" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.kilo.ai/api/gateway",
    models: [
      "kilo-auto/efficient",
      "kilo-auto/powerful",
      "kwaipilot/kat-coder-pro-v2.5",
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-4.6",
      "openai/gpt-5.2",
      "openai/o4-mini",
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.5-coder",
      "moonshotai/kimi-k3",
      "google/gemini-3-pro",
      "xai/grok-4.1",
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.deepseek.com/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "groq",
    label: "Groq",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.groq.com/openai/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    models: [],
  },
  {
    id: "mistral",
    label: "Mistral",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.mistral.ai/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    models: ["mistral-large-latest", "mistral-medium-latest", "codestral-latest"],
  },
  {
    id: "together",
    label: "Together",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.together.xyz/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.together.xyz/v1",
    models: [],
  },
  {
    id: "xai",
    label: "xAI",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.x.ai/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.x.ai/v1",
    models: ["grok-4", "grok-4-fast"],
  },
  {
    id: "cerebras",
    label: "Cerebras",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.cerebras.ai/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    models: [],
  },
  {
    id: "fireworks",
    label: "Fireworks",
    fields: [API_KEY, opt({ ...BASE_URL, placeholder: "https://api.fireworks.ai/inference/v1" })],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    models: [],
  },
  {
    id: "cloudflare-workers-ai",
    label: "Cloudflare Workers AI",
    fields: [{ ...BASE_URL, placeholder: "https://api.cloudflare.com/client/v4/accounts/{account_id}/compatible/v1" }, API_KEY],
    api: "openai",
    auth: "bearer",
    models: [],
  },
  {
    id: "ollama-self-hosted",
    label: "Ollama (self-hosted)",
    fields: [{ ...BASE_URL, placeholder: "http://localhost:11434/v1" }],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "http://localhost:11434/v1",
    models: [],
  },
  {
    id: "ollama-cloud",
    label: "Ollama Cloud",
    fields: [
      { key: "apiKey", label: "API key (ollama.com/keys)", secret: true, placeholder: "sk-…" },
      opt({ key: "sessionToken", label: "Session token (quota usage — ollama.com __Secure-session cookie)", secret: true }),
      opt({ ...BASE_URL, placeholder: "https://ollama.com/v1" }),
    ],
    api: "openai",
    auth: "bearer",
    defaultBaseUrl: "https://ollama.com/v1",
    models: [
      "kimi-k3",
      "kimi-k2.6",
      "kimi-k2.5",
      "kimi-k2.7-code",
      "glm-5.3",
      "glm-5.3-flash",
      "glm-5.2",
      "glm-5.1",
      "deepseek-v4-pro",
      "deepseek-v4-pro:0813",
      "deepseek-v4-flash",
      "deepseek-v4-flash:0731",
      "deepseek-v4.1-flash",
      "gpt-oss:120b",
      "gpt-oss:20b",
      "qwen3.5:397b",
      "minimax-m3",
      "minimax-m2.7",
      "minimax-m2.5",
      "mistral-large-3:675b",
      "nemotron-3-ultra",
      "nemotron-3-super",
      "nemotron-3-nano:30b",
      "gemma4:31b",
    ],
  },
];

export function getProviderSpec(id: string): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
