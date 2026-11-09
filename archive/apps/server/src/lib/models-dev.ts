// models.dev metadata enrichment — the same source pi uses for its catalog.

export interface ModelsDevModel {
  name?: string;
  limit?: { context?: number; input?: number; output?: number };
  cost?: { input?: number; output?: number; cache_read?: number };
  temperature?: boolean;
  reasoning?: boolean;
  reasoning_options?: { type?: string; values?: string[] }[];
  modalities?: { input?: string[]; output?: string[] };
}

export type ModelsDevCatalog = Record<string, { models?: Record<string, ModelsDevModel> }>;

/** our registry id -> models.dev provider id */
const ALIASES: Record<string, string> = {
  together: "togetherai",
  fireworks: "fireworks-ai",
  cline: "cline-pass",
  "kilo-code": "kilo",
  kimi: "kimi-code-plan-global",
  codex: "openai",
  "claude-code": "anthropic",
  "openai-compatible": "", // arbitrary endpoints have no catalog entry
  "ollama-self-hosted": "", // local models are not catalogued
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; catalog: ModelsDevCatalog } | null = null;

export async function modelsDevCatalog(): Promise<ModelsDevCatalog | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.catalog;
  try {
    const res = await fetch("https://models.dev/api.json");
    if (!res.ok) return cache?.catalog ?? null;
    const catalog = (await res.json()) as ModelsDevCatalog;
    cache = { at: Date.now(), catalog };
    return catalog;
  } catch {
    return cache?.catalog ?? null;
  }
}

export function modelsDevLookup(catalog: ModelsDevCatalog | null, providerId: string, modelId: string): ModelsDevModel | undefined {
  if (!catalog) return undefined;
  const mapped = ALIASES[providerId];
  const devId = mapped === undefined ? providerId : mapped;
  if (!devId) return undefined;
  const models = catalog[devId]?.models;
  const model = models?.[modelId];
  if (model) return model;
  // ollama-style tags ("gpt-oss:120b") are catalogued without the tag suffix
  if (modelId.includes(":")) return models?.[modelId.split(":")[0]];
  return undefined;
}
