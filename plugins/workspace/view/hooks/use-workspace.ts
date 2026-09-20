import { createContext, useContext } from "react";
import type { VaultWithWorkspaces, Workspace } from "../../shared/api";

export type WorkspaceContextValue = {
  vaults: VaultWithWorkspaces[];
  activeVault: VaultWithWorkspaces | null;
  activeWorkspace: Workspace | null;
  switchVault: (vaultId: string) => void;
  switchWorkspace: (workspaceId: string) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace requires WorkspaceProvider");
  return ctx;
}
