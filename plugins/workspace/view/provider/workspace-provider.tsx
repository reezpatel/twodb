import { useEffect, useState, type ReactNode } from "react";
import { workspaceRepo } from "../lib/api";
import { WorkspaceContext, type WorkspaceContextValue } from "../hooks/use-workspace";
import { useWorkspaceData } from "../hooks/use-workspace-data";
import { WorkspacePicker } from "../sections/picker/workspace-picker";

const ACTIVE_VAULT_KEY = "activeVaultId";
const ACTIVE_WORKSPACE_KEY = "activeWorkspaceId";

export const WorkspaceProvider: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { contextQuery, invalidate } = useWorkspaceData();
  const [activeVaultId, setActiveVaultId] = useState<string | null>(() => localStorage.getItem(ACTIVE_VAULT_KEY));
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => localStorage.getItem(ACTIVE_WORKSPACE_KEY));

  const vaults = contextQuery.data?.vaults ?? [];

  const firstRun = contextQuery.isSuccess && vaults.length === 0;
  useEffect(() => {
    if (!firstRun) return;
    void (async () => {
      const vault = await workspaceRepo.createVault("Personal");
      await workspaceRepo.createWorkspace(vault.id, "My Workspace");
      await invalidate();
    })();
  }, [firstRun, invalidate]);

  const activeVault = vaults.find((vault) => vault.id === activeVaultId) ?? null;
  const activeWorkspace = activeVault?.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  const selectWorkspace = (vaultId: string, workspaceId: string) => {
    setActiveVaultId(vaultId);
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem(ACTIVE_VAULT_KEY, vaultId);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    localStorage.setItem("activeWorkspaceId", workspaceId);
    void workspaceRepo.setActiveWorkspace(workspaceId);
  };

  if (contextQuery.isPending) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", background: "var(--bg)" }}>
        Loading…
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <WorkspacePicker
        vaults={vaults}
        onPick={(workspaceId) => {
          const vault = vaults.find((candidate) => candidate.workspaces.some((workspace) => workspace.id === workspaceId));
          if (vault) selectWorkspace(vault.id, workspaceId);
        }}
        onCreateWorkspace={(vaultId) => {
          const name = window.prompt("Workspace name");
          if (!name?.trim()) return;
          void workspaceRepo.createWorkspace(vaultId, name.trim()).then(invalidate);
        }}
      />
    );
  }

  const value: WorkspaceContextValue = {
    vaults,
    activeVault,
    activeWorkspace,
    switchVault: (vaultId) => {
      setActiveVaultId(vaultId);
      localStorage.setItem(ACTIVE_VAULT_KEY, vaultId);
      localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
      localStorage.removeItem("activeWorkspaceId");
      setActiveWorkspaceId(null);
      void workspaceRepo.clearActiveWorkspace();
    },
    switchWorkspace: (workspaceId) => {
      const vault = vaults.find((candidate) => candidate.workspaces.some((workspace) => workspace.id === workspaceId));
      if (vault) selectWorkspace(vault.id, workspaceId);
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};
