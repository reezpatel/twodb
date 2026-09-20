export type OpenRouterConnectionConfig = {
  api_key: string;
  base_url?: string;
};

export const DEFAULT_OPENROUTER_CONFIG: OpenRouterConnectionConfig = { api_key: "", base_url: "" };
