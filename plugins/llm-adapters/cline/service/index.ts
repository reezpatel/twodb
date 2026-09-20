import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbUsageSnapshot } from "@twodb/contracts";

const CLINE_API_BASE = "https://api.cline.bot";
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const MICRO_DOLLARS = 1_000_000;

const MODELS: TwodbModelInfo[] = [];

const NOT_IMPLEMENTED_COMPLETIONS =
  "not_implemented — cline has no documented chat-completions endpoint (api.cline.bot documents only auth/refresh, users/me and balance)";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function authHeaders(accessToken: string): Record<string, string> {
  const bearer = /^workos:/i.test(accessToken) ? accessToken : `workos:${accessToken}`;
  return { Authorization: `Bearer ${bearer}`, Accept: "application/json" };
}

async function getJson(path: string, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${CLINE_API_BASE}${path}`, {
    headers: authHeaders(accessToken),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`cline api error ${response.status}: ${sanitizeError(text)}`);
  }
  try {
    return asRecord(JSON.parse(text)) ?? {};
  } catch {
    throw new Error(`cline api returned invalid JSON from ${path}`);
  }
}

async function fetchUsage(ctx: TwodbAdapterContext): Promise<TwodbUsageSnapshot> {
  const accessToken = stringField(ctx.config, "access_token");
  if (!accessToken) {
    throw new Error(
      "not_implemented — cline usage needs a session access_token in the connection config; this adapter cannot run the oauth refresh because rotated tokens cannot be written back",
    );
  }

  const expiresAt = numberField(ctx.config, "expires_at");
  if (expiresAt !== undefined && expiresAt > 0 && expiresAt <= Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    throw new Error(
      `not_implemented — cline access_token expired at ${new Date(expiresAt).toISOString()}; oauth refresh is not supported because rotated tokens cannot be persisted`,
    );
  }

  const me = await getJson("/api/v1/users/me", accessToken);
  const userId = stringField(me, "id");
  if (!userId) throw new Error("cline users/me response has no id");

  const balancePayload = await getJson(`/api/v1/users/${userId}/balance`, accessToken);
  const microDollars = numberField(balancePayload, "balance");
  if (microDollars === undefined) throw new Error("cline balance response has no balance");

  return {
    kind: "cost",
    balance: { amount: microDollars / MICRO_DOLLARS, currency: "USD", as_of: new Date().toISOString() },
  };
}

const notImplemented = async (): Promise<never> => {
  throw new Error(NOT_IMPLEMENTED_COMPLETIONS);
};

const ClineAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.cline",
  displayName: "Cline",
  models: MODELS,
  tools: {
    runToolRound: notImplemented,
  },
  completions: {
    complete: notImplemented,
    async *stream() {
      yield { type: "error", error: NOT_IMPLEMENTED_COMPLETIONS };
    },
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: fetchUsage,
  },
};

const ClineServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", ClineAdapter);
  },
} satisfies ServicePlugin;

export default ClineServicePlugin;
