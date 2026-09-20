export type BedrockConnectionConfig = {
  region: string;
  access_key_id: string;
  secret_access_key: string;
  session_token?: string;
};

export const DEFAULT_BEDROCK_CONFIG: BedrockConnectionConfig = {
  region: "",
  access_key_id: "",
  secret_access_key: "",
  session_token: "",
};
