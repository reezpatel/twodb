import { useCallback, useEffect, useState } from "react";
import { FileJson, Plus } from "lucide-react";
import { useTwoDbAuth } from "@twodb/twodb-shared-frontend";
import { toolkitClient, type ConnectorInstance, type ConnectorTemplate, type McpServer } from "./lib/toolkit-client.js";
import { useToolkitData } from "./hooks/useToolkitData.js";
import { useToolkitNav } from "./hooks/useToolkitNav.js";
import { useSidebarToggle } from "./hooks/useSidebarToggle.js";
import { useInstallPrompt } from "./hooks/useInstallPrompt.js";
import { ShellChrome } from "./partials/ShellChrome.js";
import { AppHeader } from "./partials/AppHeader.js";
import { btnGhost, btnPrimary } from "./partials/ui.js";
import { ConnectorsView } from "./ConnectorsView.js";
import { McpView } from "./McpView.js";
import { TwodbToolsView } from "./TwodbToolsView.js";
import { InstanceDialog } from "./InstanceDialog.js";
import { McpDialog } from "./McpDialog.js";
import { ImportDialog } from "./ImportDialog.js";

/**
 * Toolkit shell (dispatch-style): responsive nav sidebar — Connectors / MCP servers overviews plus one entry per
 * instance and per MCP server — and a header with the page title and actions. Installable PWA.
 */
export function App() {
  const data = useToolkitData();
  const { user, logout } = useTwoDbAuth();
  const { activeId, view, select } = useToolkitNav();
  const installPrompt = useInstallPrompt();
  const { open: navOpen, toggle: toggleNav, setOpen: setNavOpen, overlay: navOverlay } = useSidebarToggle("toolkit.nav-open");

  const [instanceDialog, setInstanceDialog] = useState<null | { mode: "add"; template: ConnectorTemplate } | { mode: "edit"; instance: ConnectorInstance }>(null);
  const [mcpDialog, setMcpDialog] = useState<null | { mode: "add" } | { mode: "edit"; server: McpServer }>(null);
  const [importOpen, setImportOpen] = useState(false);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([data.refreshInstances(), data.refreshMcp()]);
  }, [data]);

  useEffect(() => {
    void data.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeInstance = view.page === "connectors" && view.id ? (data.instances.find((i) => i.id === view.id) ?? null) : null;
  const activeMcp = view.page === "mcp" && view.id ? (data.mcpServers.find((s) => s.id === view.id) ?? null) : null;

  // A deleted / unknown selection falls back to its overview once data has loaded.
  useEffect(() => {
    if (data.loading) return;
    if (view.id && !activeInstance && !activeMcp) select(view.page);
  }, [data.loading, view.id, view.page, activeInstance, activeMcp, select]);

  const openInstance = (inst: ConnectorInstance) => select(`instance:${inst.id}`);
  const openMcp = (server: McpServer) => select(`mcp:${server.id}`);

  const deleteInstance = async (instance: ConnectorInstance) => {
    if (!confirm(`Delete connector instance "${instance.name}"? Its queues and state are removed too.`)) return;
    await toolkitClient.deleteInstance(instance.id).catch(() => null);
    select("connectors");
    await refreshAll();
  };
  const deleteMcp = async (server: McpServer) => {
    if (!confirm(`Delete MCP server "${server.name}"?`)) return;
    await toolkitClient.deleteMcp(server.id).catch(() => null);
    select("mcp");
    await refreshAll();
  };

  const title = activeInstance?.name ?? activeMcp?.name ?? (view.page === "mcp" ? "MCP servers" : view.page === "twodb" ? "TwoDB tools" : "Connectors");
  const subtitle = activeMcp?.url;
  const status = data.error ?? (data.loading ? "loading…" : undefined);

  const mcpActions = view.page === "mcp" ? (
    <>
      <button type="button" onClick={() => setImportOpen(true)} className={`${btnGhost} flex items-center gap-1.5`} aria-label="Import JSON" title="Import JSON">
        <FileJson className="size-3.5" />
        <span className="hidden sm:inline">Import JSON</span>
      </button>
      <button type="button" onClick={() => setMcpDialog({ mode: "add" })} className={btnPrimary} aria-label="Add server" title="Add server">
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">Add server</span>
      </button>
    </>
  ) : null;

  return (
    <>
      <ShellChrome
        instances={data.instances}
        mcpServers={data.mcpServers}
        activeId={activeId}
        onSelect={(id) => {
          select(id);
          if (navOverlay) setNavOpen(false);
        }}
        canInstall={installPrompt.visible}
        onInstall={() => {
          void installPrompt.install().then((result) => {
            if (result === "manual") window.alert("To install Toolkit: open the browser's share menu and choose “Add to Home Screen”.");
          });
        }}
        onNavOpenChange={setNavOpen}
        userName={user?.name ?? ""}
        onSignOut={() => void logout()}
        navOpen={navOpen}
        onToggleNav={toggleNav}
        header={<AppHeader title={title} subtitle={subtitle} status={status} actions={mcpActions} />}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          {view.page === "twodb" ? (
            <TwodbToolsView data={data} />
          ) : view.page === "connectors" ? (
            <ConnectorsView
              data={data}
              active={activeInstance}
              onSelect={openInstance}
              onNewInstance={(template) => setInstanceDialog({ mode: "add", template })}
              onEditInstance={(instance) => setInstanceDialog({ mode: "edit", instance })}
              onDeleteInstance={(instance) => void deleteInstance(instance)}
            />
          ) : (
            <McpView
              data={data}
              active={activeMcp}
              onSelect={openMcp}
              onNew={() => setMcpDialog({ mode: "add" })}
              onEdit={(server) => setMcpDialog({ mode: "edit", server })}
              onDelete={(server) => void deleteMcp(server)}
            />
          )}
        </div>
      </ShellChrome>

      {instanceDialog ? (
        <InstanceDialog
          data={data}
          template={instanceDialog.mode === "add" ? instanceDialog.template : data.templates.find((t) => t.id === instanceDialog.instance.templateId)!}
          initial={instanceDialog.mode === "edit" ? instanceDialog.instance : null}
          onClose={() => setInstanceDialog(null)}
        />
      ) : null}
      {mcpDialog ? <McpDialog data={data} initial={mcpDialog.mode === "edit" ? mcpDialog.server : null} onClose={() => setMcpDialog(null)} /> : null}
      {importOpen ? <ImportDialog data={data} onClose={() => setImportOpen(false)} /> : null}
    </>
  );
}
