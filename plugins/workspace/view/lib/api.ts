import { ApiClient } from "@twodb/shared-frontend";
import type {
  CreateVaultRequest,
  CreateWorkspaceRequest,
  UpdateVaultRequest,
  UpdateWorkspaceRequest,
  Vault,
  VaultWithWorkspaces,
  Workspace,
} from "../../shared/api";

const api = new ApiClient("io.twodb.workspace");

export const workspaceRepo = {
  getContext: () => api.get<{ vaults: VaultWithWorkspaces[] }>("/context"),
  createVault: (name: string) => api.post<Vault>("/vaults", { name } satisfies CreateVaultRequest),
  updateVault: (id: string, name: string) => api.patch(`/vaults/${encodeURIComponent(id)}`, { name } satisfies UpdateVaultRequest),
  deleteVault: (id: string) => api.del(`/vaults/${encodeURIComponent(id)}`),
  createWorkspace: (vaultId: string, name: string) =>
    api.post<Workspace>(`/vaults/${encodeURIComponent(vaultId)}/workspaces`, { name } satisfies CreateWorkspaceRequest),
  updateWorkspace: (id: string, name: string) => api.patch(`/workspaces/${encodeURIComponent(id)}`, { name } satisfies UpdateWorkspaceRequest),
  deleteWorkspace: (id: string) => api.del(`/workspaces/${encodeURIComponent(id)}`),
  setActiveWorkspace: (workspaceId: string) => api.post("/active", { workspaceId }),
  clearActiveWorkspace: () => api.del("/active"),
};
