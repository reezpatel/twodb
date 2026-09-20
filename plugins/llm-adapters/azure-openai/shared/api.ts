export type AzureOpenAiConnectionConfig = {
  api_key: string;
  base_url: string;
  api_version?: string;
  deployment_map?: string;
};

export const DEFAULT_AZURE_OPENAI_CONFIG: AzureOpenAiConnectionConfig = {
  api_key: "",
  base_url: "",
  api_version: "2025-04-01-preview",
  deployment_map: "",
};
