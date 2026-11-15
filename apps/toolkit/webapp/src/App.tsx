import { useCallback, useEffect, useState } from "react";
import { Plug, Wrench } from "lucide-react";
import { toolkitClient, type ConnectorInstance, type ConnectorTemplate, type McpServer } from "./lib/toolkit-client.js";
import { useToolkitData } from "./hooks/useToolkitData.js";
import { Sidebar, type SidebarTab } from "./Sidebar.js";
import { ConnectorsView } from "./ConnectorsView.js";
import { McpView } from "./McpView.js";
import { InstanceDialog } from "./InstanceDialog.js";
import { McpDialog } from "./McpDialog.js";
import { ImportDialog } from "./ImportDialog.js";

/**
 * Toolkit shell (artisan-style): left sidebar with icon tabs — Connectors
 * (templates → instances) and MCP (user-registered servers) — and a main
 * area showing the selected view. Instance selection lives inside
 * ConnectorsView; the MCP tab opens one server's page at a time.
 */
export function App() {
  const data = useToolkitData();
  const [tab, setTab] = useState<SidebarTab>(() => (localStorage.getItem("toolkit.sidebar.tab") === "mcp" ? "mcp" : "connectors"));
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(() => localStorage.getItem("toolkit.active-instance"));
  const [activeMcpId, setActiveMcpId] = useState<string | null>(null);

  const [instanceDialog, setInstanceDialog] = useState<null | { mode: "add"; template: ConnectorTemplate } | { mode: "edit"; instance: ConnectorInstance }>(null);
  const [mcpDialog, setMcpDialog] = useState<null | { mode: "add" } | { mode: "edit"; server: McpServer }>(null);
  const [importOpen, setImportOpen] = useState(false);

  const onTab = useCallback((t: SidebarTab) => {
    setTab(t);
    localStorage.setItem("toolkit.sidebar.tab", t);
  }, []);

  const openInstance = useCallback((inst: ConnectorInstance) => {
    setActiveInstanceId(inst.id);
    localStorage.setItem("toolkit.active-instance", inst.id);
    onTab("connectors");
  }, [onTab]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([data.refreshInstances(), data.refreshMcp()]);
  }, [data]);

  useEffect(() => {
    void data.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // prune stale selection (deleted instance)
  useEffect(() => {
    if (activeInstanceId && data.instances.length > 0 && !data.instances.some((i) => i.id === activeInstanceId)) {
      setActiveInstanceId(null);
      localStorage.removeItem("toolkit.active-instance");
    }
  }, [data.instances, activeInstanceId]);

  const activeInstance = activeInstanceId ? (data.instances.find((i) => i.id === activeInstanceId) ?? null) : null;
  const activeMcp = activeMcpId ? (data.mcpServers.find((s) => s.id === activeMcpId) ?? null) : null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-ink">
      <Sidebar
        tab={tab}
        onTab={onTab}
        spaces={data.spaces}
        templates={data.templates}
        instances={data.instances}
        activeInstanceId={tab === "connectors" ? activeInstanceId : null}
        onOpenInstance={openInstance}
        onNewInstance={(template) => setInstanceDialog({ mode: "add", template })}
        onEditInstance={(instance) => setInstanceDialog({ mode: "edit", instance })}
        onDeleteInstance={async (instance) => {
          await toolkitClient.deleteInstance(instance.id).catch(() => null);
          if (activeInstanceId === instance.id) {
            setActiveInstanceId(null);
            localStorage.removeItem("toolkit.active-instance");
          }
          await refreshAll();
        }}
        mcpServers={data.mcpServers}
        activeMcpId={tab === "mcp" ? activeMcpId : null}
        onNewMcp={() => setMcpDialog({ mode: "add" })}
        onOpenMcp={(server) => {
          setActiveMcpId(server.id);
          onTab("mcp");
        }}
        onEditMcp={(server) => setMcpDialog({ mode: "edit", server })}
        onDeleteMcp={async (server) => {
          await toolkitClient.deleteMcp(server.id).catch(() => null);
          if (activeMcpId === server.id) setActiveMcpId(null);
          await refreshAll();
        }}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-outline/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
              {tab === "connectors" ? <Plug className="size-4" /> : <Wrench className="size-4" />}
            </div>
            <h1 className="text-[15px] font-semibold tracking-tight">Toolkit</h1>
          </div>
          {tab === "mcp" && activeMcp ? (
            <span className="truncate font-mono text-[13px] text-ink-muted">{activeMcp.name} · {activeMcp.url}</span>
          ) : null}
          {tab === "connectors" && activeInstance ? (
            <span className="truncate text-[13px] text-ink-muted">{activeInstance.name}</span>
          ) : null}
          <div className="ml-auto text-[11px] text-ink-muted">{data.error ?? (data.loading ? "loading…" : "")}</div>
          {tab === "mcp" ? (
            <button type="button" onClick={() => setImportOpen(true)} className="rounded-md border border-outline/60 px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:border-outline-strong hover:text-ink">
              Import JSON
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "connectors" ? (
            <ConnectorsView
              data={data}
              activeInstanceId={activeInstanceId}
              onSelect={openInstance}
              onNewInstance={(template) => setInstanceDialog({ mode: "add", template })}
              onEditInstance={(instance) => setInstanceDialog({ mode: "edit", instance })}
            />
          ) : (
            <McpView
              data={data}
              active={activeMcp}
              onSelect={(server) => setActiveMcpId(server.id)}
              onNew={() => setMcpDialog({ mode: "add" })}
              onEdit={(server) => setMcpDialog({ mode: "edit", server })}
            />
          )}
        </div>
      </main>

      {instanceDialog ? (
        <InstanceDialog
          data={data}
          template={instanceDialog.mode === "add" ? instanceDialog.template : data.templates.find((t) => t.id === instanceDialog.instance.templateId)!}
          initial={instanceDialog.mode === "edit" ? instanceDialog.instance : null}
          onClose={() => setInstanceDialog(null)}
        />
      ) : null}
      {mcpDialog ? (
        <McpDialog
          data={data}
          initial={mcpDialog.mode === "edit" ? mcpDialog.server : null}
          onClose={() => setMcpDialog(null)}
        />
      ) : null}
      {importOpen ? <ImportDialog data={data} onClose={() => setImportOpen(false)} /> : null}
    </div>
  );
}
