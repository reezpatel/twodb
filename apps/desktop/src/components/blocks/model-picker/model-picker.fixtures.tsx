import { useState, type ReactNode } from "react";
import { ModelPicker, type ModelPickerProps } from "./model-picker";
import { ModelPickerTrigger } from "./model-picker-trigger";
import type { ModelPickerConfig, ModelPickerModel, ModelPickerProvider } from "./model-picker-types";

const CATALOG = [
  { id: "anthropic", label: "Anthropic", families: ["Opus", "Sonnet", "Haiku"] },
  { id: "openai", label: "OpenAI", families: ["GPT", "o-series", "GPT mini"] },
  { id: "google", label: "Google", families: ["Gemini Pro", "Gemini Flash", "Gemma"] },
  { id: "mistral", label: "Mistral", families: ["Large", "Medium", "Codestral"] },
  { id: "meta", label: "Meta", families: ["Llama", "Llama Instruct"] },
  { id: "deepseek", label: "DeepSeek", families: ["Chat", "Reasoner", "Coder"] },
  { id: "xai", label: "xAI", families: ["Grok", "Grok mini"] },
  { id: "openrouter", label: "OpenRouter", families: ["Auto", "Free tier", "Community"] },
];

export const PROVIDERS: ModelPickerProvider[] = CATALOG.map(({ id, label }) => ({ id, label }));

export function buildModels(count = 1200): ModelPickerModel[] {
  return Array.from({ length: count }, (_, index) => {
    const provider = CATALOG[index % CATALOG.length];
    const family = provider.families[Math.floor(index / CATALOG.length) % provider.families.length];
    const version = Math.floor(index / (CATALOG.length * provider.families.length)) + 1;
    const variant = index % 5;
    const supportsThinking = index % 4 !== 3;
    return {
      id: `${provider.id}/${family.toLowerCase().replace(/\s+/g, "-")}-${version}.${variant}`,
      label: `${family} ${version}.${variant}`,
      provider: provider.id,
      description: `${provider.label} ${family} — general coding and reasoning.`,
      efforts: ["High", "Medium", "Low"],
      contexts: index % 3 === 0 ? ["200K", "1M"] : ["128K"],
      supportsFast: index % 2 === 0,
      supportsThinking,
      defaultConfig: { effort: "Medium", context: index % 3 === 0 ? "200K" : "128K", fast: false, thinking: false },
      badges: supportsThinking ? ["thinking"] : undefined,
    };
  });
}

export const MODELS = buildModels();
export const DEFAULT_FAVORITES = MODELS.slice(0, 6).map((model) => model.id);

type ModelPickerPlaygroundProps = Partial<
  Pick<ModelPickerProps, "models" | "side" | "disabled" | "defaultOpen" | "defaultBrowserOpen" | "defaultEditingId">
> & {
  initialFavorites?: string[];
  initialSelectedId?: string | null;
  triggerClassName?: string;
  onEvent?: (message: string) => void;
  /** A custom trigger — passed straight through as <ModelPicker> children. */
  children?: ReactNode;
};

/** Story helper: holds the state a real caller would own and wires the callbacks. */
export function ModelPickerPlayground({
  models = MODELS,
  initialFavorites = DEFAULT_FAVORITES,
  initialSelectedId,
  triggerClassName,
  onEvent,
  children,
  ...props
}: ModelPickerPlaygroundProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? initialFavorites[0] ?? models[0]?.id ?? null);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [configs, setConfigs] = useState<Record<string, ModelPickerConfig>>({});

  return (
    <ModelPicker
      models={models}
      providers={PROVIDERS}
      selectedId={selectedId}
      configs={configs}
      favorites={favorites}
      onModelPicked={(id, info) => {
        setSelectedId(id);
        onEvent?.(`picked ${id} (${info.oneTime ? "one-time" : "favorite"}, from ${info.source})`);
      }}
      onConfigChanged={(id, patch) => {
        setConfigs((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
        onEvent?.(`config ${id} ${JSON.stringify(patch)}`);
      }}
      onFavoriteAdded={(id) => {
        setFavorites((current) => [...current, id]);
        onEvent?.(`favorite added ${id}`);
      }}
      onFavoriteRemoved={(id) => {
        setFavorites((current) => current.filter((favorite) => favorite !== id));
        onEvent?.(`favorite removed ${id}`);
      }}
      {...props}
    >
      {triggerClassName ? <ModelPickerTrigger className={triggerClassName} /> : children}
    </ModelPicker>
  );
}
