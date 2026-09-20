import type { TwodbConnectionOverrides, TwodbLlmWorkspaceSettings, TwodbModelInfo } from "@twodb/contracts";

export type LlmConnection = {
  id: string;
  provider: string;
  name: string;
  config: Record<string, unknown>;
  overrides: TwodbConnectionOverrides | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type LlmProviderSummary = {
  id: string;
  name: string;
  models: TwodbModelInfo[];
};

export type LlmOverview = {
  settings: TwodbLlmWorkspaceSettings;
  connections: LlmConnection[];
  providers: LlmProviderSummary[];
};

export type CreateLlmConnectionRequest = {
  provider: string;
  name: string;
  config?: Record<string, unknown>;
};

export type UpdateLlmConnectionRequest = {
  name?: string;
  config?: Record<string, unknown>;
  overrides?: TwodbConnectionOverrides | null;
  enabled?: boolean;
};

export type UpdateLlmWorkspaceSettingsRequest = Partial<Omit<TwodbLlmWorkspaceSettings, "default_model">> & {
  default_model?: { provider: string; model: string } | null;
};

export type LlmCompletionProxyRequest = {
  connection_id: string;
  request: import("@twodb/contracts").TwodbCompletionRequest;
};

export type LlmModelTuningResult = {
  connection_id: string;
  model: string;
  context_window: number;
  effective_context_window_percent: number;
  effective_context_tokens: number;
  truncation_policy: TwodbLlmWorkspaceSettings["truncation_policy"];
};
