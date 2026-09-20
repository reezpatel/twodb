export type OpenAiConnectionConfig = {
  api_key: string;
  base_url?: string;
  org?: string;
};

export const DEFAULT_OPENAI_CONFIG: OpenAiConnectionConfig = { api_key: "", base_url: "", org: "" };
