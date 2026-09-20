import { ApiClient } from "@twodb/shared-frontend";
import type { CreatedNode, CreateNodeRequest, PatchRequest, RunCommandRequest, TwodbNodeCommand, TwodbNodeInfo, TwodbNodePatch } from "../../shared/api";

const api = new ApiClient("io.twodb.node");

export const nodeRepo = {
  listNodes: () => api.get<{ nodes: TwodbNodeInfo[] }>("/nodes"),
  createNode: (body: CreateNodeRequest) => api.post<CreatedNode>("/nodes", body),
  deleteNode: (id: string) => api.del(`/nodes/${encodeURIComponent(id)}`),
  rotateToken: (id: string) => api.post<{ token: string }>(`/nodes/${encodeURIComponent(id)}/token`),
  recentCommands: (nodeId: string, limit = 20) => api.get<{ commands: TwodbNodeCommand[] }>(`/nodes/${encodeURIComponent(nodeId)}/commands?limit=${limit}`),
  runCommand: (nodeId: string, body: RunCommandRequest) => api.post<{ command: TwodbNodeCommand }>(`/nodes/${encodeURIComponent(nodeId)}/commands`, body),
  killCommand: (commandId: string) => api.post<{ ok: boolean }>(`/commands/${encodeURIComponent(commandId)}/kill`),
  patch: (nodeId: string, body: PatchRequest) => api.post<{ patch: TwodbNodePatch }>(`/nodes/${encodeURIComponent(nodeId)}/patch`, body),
  patchStatus: (patchId: string) => api.get<{ patch: TwodbNodePatch }>(`/patches/${encodeURIComponent(patchId)}`),
};

export const commandStreamUrl = (commandId: string) => `/api/v1/io.twodb.node/commands/${encodeURIComponent(commandId)}/stream`;
