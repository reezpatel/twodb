export type Vault = {
  id: string;
  name: string;
  created_at: string;
};

export type Workspace = {
  id: string;
  vault_id: string;
  name: string;
  created_at: string;
};

export type VaultWithWorkspaces = Vault & {
  workspaces: Workspace[];
};

// GET /context
export type WorkspaceContextResponse = {
  vaults: VaultWithWorkspaces[];
};

// POST /vaults
export type CreateVaultRequest = {
  name: string;
};

// PATCH /vaults/:id
export type UpdateVaultRequest = {
  name: string;
};

// POST /vaults/:id/workspaces
export type CreateWorkspaceRequest = {
  name: string;
};

// PATCH /workspaces/:id
export type UpdateWorkspaceRequest = {
  name: string;
};

export type WorkspaceApiError = {
  error: string;
  message?: string;
};
