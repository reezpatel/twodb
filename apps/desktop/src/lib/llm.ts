export interface LlmProviderField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
}

export interface LlmProvider {
  id: string;
  label: string;
  fields: LlmProviderField[];
  api: "anthropic" | "openai" | null;
  defaultBaseUrl?: string;
  models: string[];
}

export interface LlmConnection {
  id: string;
  organizationId: string;
  provider: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LlmModel {
  id: string;
  connectionId: string;
  modelId: string;
  displayName: string | null;
  contextWindow: number | null;
}

export interface LlmUsage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  lastUsedAt: string | null;
}
