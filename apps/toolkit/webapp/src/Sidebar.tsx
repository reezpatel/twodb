import { useMemo, useState } from "react";
import { Pencil, Plug, Plus, Settings2, Trash2, Wrench } from "lucide-react";
import type { ConnectorInstance, ConnectorTemplate, McpServer, Space } from "./lib/toolkit-client.js";
import { cn } from "./lib/cn.js";
import { useResizableWidth } from "./lib/useResizableWidth.js";

export type SidebarTab = "connectors" | "mcp";

const TABS: Array<{ id: SidebarTab; label: string; icon: typeof Plug }> = [
  { id: "connectors", label: "Connectors", icon: Plug },
  { id: "mcp", label: "MCP", icon: Wrench },
];

export interface SidebarProps {
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  spaces: Space[];
  templates: ConnectorTemplate[];
  instances: ConnectorInstance[];
  activeInstanceId: string | null;
  onOpenInstance: (instance: ConnectorInstance) => void;
  onNewInstance: (template: ConnectorTemplate) => void;
  onEditInstance: (instance: ConnectorInstance) => void;
  onDeleteInstance: (instance: ConnectorInstance) => Promise<void> | void;
  mcpServers: McpServer[];
  activeMcpId: string | null;
  onNewMcp: () => void;
  onOpenMcp: (server: McpServer) => void;
  onEditMcp: (server: McpServer) => void;
  onDeleteMcp: (server: McpServer) => Promise<void> | void;
}

/** Artisan-style left sidebar: icon tab strip, per-tab lists, resizable width. */
export function Sidebar(props: SidebarProps) {
  const { width, Handle } = useResizableWidth("toolkit.sidebar.left", 260, 200, 480);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const templateName = (id: string) => props.templates.find((t) => t.id === id)?.name ?? id;

  // group instances by template, hidden when collapsed to zero visible
  const groups = useMemo(() => {
    const map = new Map<string, ConnectorInstance[]>();
    for (const t of props.templates) map.set(t.id, []);
    for (const i of props.instances) {
      const list = map.get(i.templateId) ?? [];
      list.push(i);
      map.set(i.templateId, list);
    }
    return [...map.entries()];
  }, [props.templates, props.instances]);

  return (
    <div className="flex h-full min-h-0 shrink-0" style={{ width }}>
      <div className="flex h-full min-h-0 w-full flex-col border-r border-outline/50 bg-surface p-3">
        {/* header: active tab label + the tab's primary action */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2">
          <span className="min-w-0 flex-1 truncate px-1.5 text-[13px] font-medium text-ink">
            {props.tab === "connectors" ? "Connectors" : "MCP servers"}
          </span>
          {props.tab === "mcp" ? (
            <button type="button" aria-label="New MCP server" title="New MCP server" onClick={props.onNewMcp}
              className={iconBtnCls}>
              <Plus className="size-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>

        {/* icon tab strip */}
        <div role="tablist" className="mb-2 flex shrink-0 gap-1 rounded-lg bg-surface-muted p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={props.tab === t.id}
              aria-label={t.label}
              title={t.label}
              onClick={() => props.onTab(t.id)}
              className={cn(
                "flex h-7 flex-1 items-center justify-center rounded-md transition-colors",
                props.tab === t.id ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              <t.icon className="size-4" strokeWidth={1.5} />
            </button>
          ))}
        </div>

        {/* lists */}
        {props.tab === "connectors" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.length === 0 && props.templates.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-muted">No connector templates registered.</p>
            ) : null}
            {groups.map(([templateId, list]) => {
              const template = props.templates.find((t) => t.id === templateId)!;
              const isCollapsed = collapsed[templateId] ?? false;
              return (
                <div key={templateId} className="flex flex-col gap-0.5">
                  <div className="group/header flex items-center pr-1">
                    <button
                      type="button"
                      className="group/title flex min-w-0 flex-1 items-center gap-1 px-2.5 pb-1 text-left"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((c) => ({ ...c, [templateId]: isCollapsed ? false : true }))}
                      title={template.description}
                    >
                      <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-ink-muted/50 transition-colors group-hover/title:text-ink-muted">
                        {template.name}
                      </span>
                      <svg
                        className={cn("size-3 shrink-0 text-ink-muted/40 opacity-0 transition-all group-hover/title:opacity-100", !isCollapsed && "rotate-90")}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`New ${template.name} instance`}
                      title={`New ${template.name} instance`}
                      onClick={() => props.onNewInstance(template)}
                      className="rounded-sm p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-ink focus-visible:opacity-100 group-hover/header:opacity-100"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  {isCollapsed ? null : list.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => props.onNewInstance(template)}
                      className="mx-1 rounded-md border border-dashed border-outline/60 px-2.5 py-2 text-left text-[12px] text-ink-muted transition-colors hover:border-outline-strong hover:text-ink"
                    >
                      + configure an instance
                    </button>
                  ) : (
                    list.map((inst) => (
                      <div
                        key={inst.id}
                        className={cn(
                          "group flex items-center rounded-lg pr-1 transition-colors",
                          props.activeInstanceId === inst.id ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink",
                        )}
                      >
                        <button type="button" onClick={() => props.onOpenInstance(inst)} className="flex min-w-0 flex-1 items-center gap-2 py-[7px] pl-2.5 text-left text-[13px] leading-none">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              !inst.enabled ? "bg-outline-strong" : inst.healthStatus === "error" ? "bg-destructive" : inst.healthStatus === "ok" ? "bg-emerald-500" : "bg-warning",
                            )}
                            title={inst.healthError ?? inst.healthStatus ?? "not checked"}
                          />
                          <span className={cn("min-w-0 flex-1 truncate font-light", !inst.enabled && "opacity-50")}>{inst.name}</span>
                        </button>
                        <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button type="button" aria-label={`Edit ${inst.name}`} title="Edit instance" className="rounded-sm p-1 hover:bg-surface-muted hover:text-ink" onClick={() => props.onEditInstance(inst)}>
                            <Settings2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${inst.name}`}
                            title="Delete instance"
                            className="rounded-sm p-1 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete connector instance "${inst.name}"? Its queues and state are removed too.`)) void props.onDeleteInstance(inst);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {props.mcpServers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <p className="text-[13px] leading-relaxed text-ink-muted">No MCP servers yet. Register any remote http/sse tool endpoint.</p>
                <button type="button" className="rounded-md border border-outline px-3 py-1 text-[12px] hover:bg-surface-muted" onClick={props.onNewMcp}>
                  New MCP server
                </button>
              </div>
            ) : (
              props.mcpServers.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center rounded-lg pr-1 transition-colors",
                    props.activeMcpId === s.id ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink",
                  )}
                >
                  <button type="button" onClick={() => props.onOpenMcp(s)} title={s.url} className="flex min-w-0 flex-1 items-center gap-2 py-[7px] pl-2.5 text-left font-mono text-[13px] leading-none">
                    <span className={cn("size-1.5 shrink-0 rounded-full", s.enabled ? "bg-emerald-500" : "bg-outline-strong")} />
                    <span className={cn("min-w-0 flex-1 truncate font-light", !s.enabled && "opacity-50")}>{s.name}</span>
                    <span className="shrink-0 text-[10px] uppercase text-ink-muted/50">{s.transport}</span>
                  </button>
                  <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" aria-label={`Edit ${s.name}`} title="Edit MCP server" className="rounded-sm p-1 hover:bg-surface-muted hover:text-ink" onClick={() => props.onEditMcp(s)}>
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${s.name}`}
                      title="Delete MCP server"
                      className="rounded-sm p-1 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete MCP server "${s.name}"?`)) void props.onDeleteMcp(s);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <Handle />
    </div>
  );
}

const iconBtnCls = "flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink";
