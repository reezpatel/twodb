export type CloudflareWorkersAiConnectionConfig = {
  account_id: string;
  api_token: string;
};

export const DEFAULT_CLOUDFLARE_WORKERS_AI_CONFIG: CloudflareWorkersAiConnectionConfig = {
  account_id: "",
  api_token: "",
};
