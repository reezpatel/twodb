export type CloudflareAiGatewayConnectionConfig = {
  account_id: string;
  gateway_id: string;
  api_key?: string;
};

export const DEFAULT_CLOUDFLARE_AI_GATEWAY_CONFIG: CloudflareAiGatewayConnectionConfig = {
  account_id: "",
  gateway_id: "",
  api_key: "",
};
