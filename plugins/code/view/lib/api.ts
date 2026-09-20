import { ApiClient } from "@twodb/shared-frontend";
import type { TwodbNodeInfo } from "@twodb/node/shared/api";
import type { CodeSession, CreateSessionRequest, StoredMessage } from "../../shared/api";

const api = new ApiClient("io.twodb.code");
const nodeApi = new ApiClient("io.twodb.node");
const llmApi = new ApiClient("io.twodb.llm");

export type LlmConnectionOption = {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
};

export type LlmProviderCatalog = {
  id: string;
  name: string;
  models: Array<{ id: string; display_name: string }>;
};

export const codeRepo = {
  listSessions: () => api.get<{ sessions: CodeSession[] }>("/sessions"),
  createSession: (body: CreateSessionRequest) => api.post<{ session: CodeSession }>("/sessions", body),
  getSession: (id: string) => api.get<{ session: CodeSession; messages: StoredMessage[] }>(`/sessions/${encodeURIComponent(id)}`),
  updateSession: (id: string, body: { connection_id?: string | null }) => api.patch<{ session: CodeSession }>(`/sessions/${encodeURIComponent(id)}`, body),
  deleteSession: (id: string) => api.del(`/sessions/${encodeURIComponent(id)}`),
  runSession: (id: string, message: string) => api.post<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}/run`, { message }),
};

export const nodeRepo = {
  listNodes: () => nodeApi.get<{ nodes: TwodbNodeInfo[] }>("/nodes"),
};

export const llmRepo = {
  listOverview: () => llmApi.get<{ connections: LlmConnectionOption[]; providers: LlmProviderCatalog[] }>("/overview"),
  listConnections: () => llmApi.get<{ connections: LlmConnectionOption[] }>("/overview"),
};

export const sessionStreamUrl = (sessionId: string) => `/api/v1/io.twodb.code/sessions/${encodeURIComponent(sessionId)}/stream`;

export const llmConnectionsQueryKey = ["llm", "overview"] as const;
