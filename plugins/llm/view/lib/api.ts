import { ApiClient } from "@twodb/shared-frontend";
import type { CreateLlmConnectionRequest, LlmConnection, LlmOverview, UpdateLlmConnectionRequest, UpdateLlmWorkspaceSettingsRequest } from "../../shared/api";

const api = new ApiClient("io.twodb.llm");

export const llmRepo = {
  getOverview: () => api.get<LlmOverview>("/overview"),
  updateSettings: (settings: UpdateLlmWorkspaceSettingsRequest) => api.patch("/settings", settings),
  createConnection: (body: CreateLlmConnectionRequest) => api.post<LlmConnection>("/connections", body),
  updateConnection: (id: string, body: UpdateLlmConnectionRequest) => api.patch<LlmConnection>(`/connections/${encodeURIComponent(id)}`, body),
  deleteConnection: (id: string) => api.del(`/connections/${encodeURIComponent(id)}`),
  getConnectionUsage: (id: string) => api.get(`/connections/${encodeURIComponent(id)}/usage`),
};
