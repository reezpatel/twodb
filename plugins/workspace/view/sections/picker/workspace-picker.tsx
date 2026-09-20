import { Button } from "@twodb/ui";
import type { VaultWithWorkspaces } from "../../../shared/api";

export function WorkspacePicker({
  vaults,
  onPick,
  onCreateWorkspace,
}: {
  vaults: VaultWithWorkspaces[];
  onPick: (workspaceId: string) => void;
  onCreateWorkspace: (vaultId: string) => void;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div
        style={{
          width: 400,
          maxHeight: "80vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: 32,
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: "var(--text-xl)", color: "var(--ink)" }}>Choose a workspace</h1>
          <p style={{ margin: 0, fontSize: "var(--text-md)", color: "var(--ink-3)" }}>Pick up where you left off, or start somewhere new.</p>
        </div>

        {vaults.map((vault) => (
          <section key={vault.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--ink)" }}>{vault.name}</h2>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>vault</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {vault.workspaces.length === 0 ? (
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>No workspaces in this vault yet.</p>
              ) : (
                vault.workspaces.map((workspace) => (
                  <Button key={workspace.id} variant="secondary" onClick={() => onPick(workspace.id)}>
                    {workspace.name}
                  </Button>
                ))
              )}
              <Button variant="ghost" size="sm" onClick={() => onCreateWorkspace(vault.id)}>
                New workspace…
              </Button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
