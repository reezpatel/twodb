import { db } from "../auth";
import type { LlmConnectionTable } from "../plugins/db";
import { getProvider, providerAuthHeaders, providerBaseUrl } from "./llm-providers";

interface FetchedModel {
  modelId: string;
  displayName: string | null;
  contextWindow: number | null;
  thinking: boolean;
  input: ("text" | "image" | "video")[];
  thinkingLevel: string[];
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
    }));
}

/**
 * Refreshes a connection's model list from the provider. Falls back to the
 * provider's static model list when the API is unreachable or unimplemented,
 * so dropdowns are never empty for known providers.
 */
export async function refreshConnectionModels(connection: LlmConnectionTable): Promise<{ count: number; warning?: string }> {
  const provider = getProvider(connection.provider);
  let models: FetchedModel[] = [];
  let warning: string | undefined;

  try {
    models = await fetchProviderModels(connection);
  } catch (e) {
    warning = (e as Error).message;
  }

  if (models.length === 0 && provider && provider.models.length > 0) {
    models = provider.models.map((id) => ({
      modelId: id,
      displayName: null,
      contextWindow: null,
      thinking: false,
      input: [] as ("text" | "image" | "video")[],
      thinkingLevel: [] as string[],
    }));
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
          createdAt: now,
        })),
      )
      .execute();
  }

  return { count: models.length, warning };
}
