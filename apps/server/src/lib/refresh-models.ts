import { db } from "../auth";
import type { LlmConnectionTable } from "../plugins/db";
import { getProvider, providerAuthHeaders, providerBaseUrl } from "./llm-providers";
import { modelsDevCatalog, modelsDevLookup, type ModelsDevModel } from "./models-dev";

interface FetchedModel {
  modelId: string;
  displayName: string | null;
  contextWindow: number | null;
  thinking: boolean;
  input: ("text" | "image" | "video")[];
  thinkingLevel: string[];
  temperature: boolean;
  limitContext: number | null;
  limitInput: number | null;
  limitOutput: number | null;
  costInput: number | null;
  costOutput: number | null;
  costCacheRead: number | null;
  output: string[];
}

const MODALITIES = new Set(["text", "image", "video"]);

function enrich(base: FetchedModel, meta: ModelsDevModel | undefined): FetchedModel {
  if (!meta) return base;
  const reasoning = meta.reasoning;
  const thinking = reasoning === true || (meta.reasoning_options?.some((o) => (o.values?.length ?? 0) > 0) ?? false);
  const thinkingLevel = (meta.reasoning_options ?? []).flatMap((o) => o.values ?? []).filter((v) => typeof v === "string");
  return {
    ...base,
    displayName: base.displayName ?? (typeof meta.name === "string" && meta.name ? meta.name : null),
    contextWindow: base.contextWindow ?? meta.limit?.context ?? null,
    thinking: base.thinking || thinking,
    input: base.input.length > 0 ? base.input : (meta.modalities?.input ?? []).filter((m): m is "text" | "image" | "video" => MODALITIES.has(m)),
    thinkingLevel: thinkingLevel.length > 0 ? thinkingLevel : base.thinkingLevel,
    temperature: meta.temperature === true,
    limitContext: meta.limit?.context ?? null,
    limitInput: meta.limit?.input ?? null,
    limitOutput: meta.limit?.output ?? null,
    costInput: meta.cost?.input ?? null,
    costOutput: meta.cost?.output ?? null,
    costCacheRead: meta.cost?.cache_read ?? null,
    output: meta.modalities?.output ?? [],
  };
}

async function fetchProviderModels(connection: LlmConnectionTable): Promise<FetchedModel[]> {
  const provider = getProvider(connection.provider);
  if (!provider?.api || provider.api === "responses") throw new Error("provider does not support model listing");

  const config = connection.config as Record<string, string>;
  const baseUrl = providerBaseUrl(provider, config);
  const url = provider.api === "openai" ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

  // Model listing runs server-side; base URLs are org-admin-configured.
  const res = await fetch(url, {
    method: "GET",
    headers: providerAuthHeaders(provider, config),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`provider returned ${res.status}: ${body.slice(0, 200)}`);
  }

  let json: {
    data?: {
      id?: unknown;
      display_name?: unknown;
      context_window?: unknown;
    }[];
  };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("provider returned invalid JSON");
  }
  const data = Array.isArray(json.data) ? json.data : [];
  return data
    .filter((m) => typeof m.id === "string" && m.id)
    .map((m) => ({
      modelId: m.id as string,
      displayName: typeof m.display_name === "string" ? m.display_name : null,
      contextWindow: typeof m.context_window === "number" ? m.context_window : null,
      thinking: false,
      input: [] as ("text" | "image" | "video")[],
      thinkingLevel: [] as string[],
      temperature: false,
      limitContext: null,
      limitInput: null,
      limitOutput: null,
      costInput: null,
      costOutput: null,
      costCacheRead: null,
      output: [] as string[],
    }));
}

/**
 * Refreshes a connection's model list from the provider, enriched with
 * models.dev metadata (limits, costs, modalities, temperature support).
 * Falls back to the provider's static list so dropdowns are never empty.
 */
export async function refreshConnectionModels(connection: LlmConnectionTable): Promise<{ count: number; warning?: string }> {
  const provider = getProvider(connection.provider);
  let models: FetchedModel[] = [];
  const warnings: string[] = [];

  try {
    models = await fetchProviderModels(connection);
  } catch (e) {
    warnings.push((e as Error).message);
  }

  if (models.length === 0 && provider && provider.models.length > 0) {
    models = provider.models.map((id) => ({
      modelId: id,
      displayName: null,
      contextWindow: null,
      thinking: false,
      input: [] as ("text" | "image" | "video")[],
      thinkingLevel: [] as string[],
      temperature: false,
      limitContext: null,
      limitInput: null,
      limitOutput: null,
      costInput: null,
      costOutput: null,
      costCacheRead: null,
      output: [] as string[],
    }));
  }

  const catalog = await modelsDevCatalog();
  if (catalog) {
    models = models.map((m) => enrich(m, modelsDevLookup(catalog, connection.provider, m.modelId)));
  } else if (models.length > 0) {
    warnings.push("models.dev metadata unavailable");
  }

  const now = new Date();
  await db.deleteFrom("llm_model").where("connectionId", "=", connection.id).execute();
  if (models.length > 0) {
    await db
      .insertInto("llm_model")
      .values(
        models.map((m) => ({
          id: crypto.randomUUID(),
          connectionId: connection.id,
          organizationId: connection.organizationId,
          modelId: m.modelId,
          displayName: m.displayName,
          contextWindow: m.contextWindow,
          thinking: m.thinking,
          input: m.input,
          thinkingLevel: m.thinkingLevel,
          temperature: m.temperature,
          limitContext: m.limitContext,
          limitInput: m.limitInput,
          limitOutput: m.limitOutput,
          costInput: m.costInput,
          costOutput: m.costOutput,
          costCacheRead: m.costCacheRead,
          output: m.output,
          createdAt: now,
        })),
      )
      .execute();
  }

  return { count: models.length, warning: warnings.length > 0 ? warnings.join("; ") : undefined };
}
