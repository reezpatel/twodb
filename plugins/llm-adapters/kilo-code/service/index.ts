import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbUsageSnapshot } from "@twodb/contracts";
import type { KiloCodeConnectionConfig } from "../shared/api";

const MODELS: TwodbModelInfo[] = [];

const NOT_IMPLEMENTED_COMPLETIONS =
  "not_implemented — kilo-code has no documented inference endpoint (the session_cookie only authenticates the web app; no chat-completions URL is documented in-repo)";

const notImplementedCompletions = async (): Promise<never> => {
  throw new Error(NOT_IMPLEMENTED_COMPLETIONS);
};

const KILO_BALANCE_URL = "https://app.kilo.ai/api/profile/balance";
const KILO_SESSION_URL = "https://app.kilo.ai/api/auth/session";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const sanitize = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, 200) || "unknown";

async function sessionExpiry(headers: Record<string, string>): Promise<string | null> {
  try {
    const response = await fetch(KILO_SESSION_URL, { headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const data = asRecord(JSON.parse(await response.text()));
    const expires = typeof data?.["expires"] === "string" && Number.isFinite(Date.parse(data["expires"])) ? data["expires"] : null;
    return expires ? new Date(Date.parse(expires)).toISOString() : null;
  } catch {
    return null;
  }
}

async function fetchUsage(ctx: TwodbAdapterContext): Promise<TwodbUsageSnapshot> {
  const cookie = (ctx.config as Partial<KiloCodeConnectionConfig>).session_cookie ?? "";
  if (!cookie) throw new Error("kilo-code usage requires session_cookie in the connection config");

  const headers = {
    Cookie: `__Secure-next-auth.session-token=${cookie}`,
    "User-Agent": "twodb/1.0",
    Accept: "application/json",
  };

  const response = await fetch(KILO_BALANCE_URL, { headers, signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Kilo Code API error ${response.status}: ${sanitize(text)}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Kilo Code balance returned invalid JSON");
  }
  const data = asRecord(parsed);
  const balance = data && typeof data["balance"] === "number" && Number.isFinite(data["balance"]) ? data["balance"] : null;
  if (balance === null) throw new Error("Kilo Code balance response invalid — session cookie may have expired");

  return {
    kind: "cost",
    balance: { amount: balance, currency: "USD", as_of: (await sessionExpiry(headers)) ?? new Date().toISOString() },
  };
}

const KiloCodeAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.kilo-code",
  displayName: "Kilo Code",
  models: MODELS,
  tools: {
    runToolRound: notImplementedCompletions,
  },
  completions: {
    complete: notImplementedCompletions,
    async *stream() {
      yield { type: "error", error: NOT_IMPLEMENTED_COMPLETIONS };
    },
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: fetchUsage,
  },
};

const KiloCodeServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", KiloCodeAdapter);
  },
} satisfies ServicePlugin;

export default KiloCodeServicePlugin;
