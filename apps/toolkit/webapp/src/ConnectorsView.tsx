import { type ConnectorInstance, type ConnectorTemplate } from "./lib/toolkit-client.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { InstancePage } from "./InstancePage.js";

/**
 * Connectors main view: when an instance is selected (sidebar) show its page
 * (tools / broadcasts / queues / settings); otherwise the gallery + instance
 * list as a landing grid.
 */
export function ConnectorsView({ data, activeInstanceId, onSelect, onNewInstance, onEditInstance }: {
  data: ToolkitData;
  activeInstanceId: string | null;
  onSelect: (instance: ConnectorInstance) => void;
  onNewInstance: (template: ConnectorTemplate) => void;
  onEditInstance: (instance: ConnectorInstance) => void;
}) {
  const active = activeInstanceId ? (data.instances.find((i) => i.id === activeInstanceId) ?? null) : null;
  if (active) return <InstancePage data={data} instance={active} />;

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section>
          <h2 className="text-[14px] font-semibold">Connector templates</h2>
          <p className="text-[12px] text-ink-muted">Predefined integrations — configure an instance per account/workspace.</p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.templates.map((t) => (
              <li key={t.id} className="flex flex-col rounded-lg border border-outline/60 bg-surface p-4">
                <div className="flex items-center gap-2.5">
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold">{t.name}</h3>
                    <p className="text-[11px] text-ink-muted">
                      {t.commands.length} tools{t.broadcasts.length ? ` · ${t.broadcasts.length} broadcasts` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNewInstance(t)}
                    className="ml-auto flex items-center gap-1 rounded-md border border-outline/60 px-2 py-1 text-[12px] text-ink-muted transition-colors hover:border-outline-strong hover:text-ink"
                  >
                    + New instance
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-[12px] text-ink-muted">{t.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-[14px] font-semibold">Instances</h2>
          <p className="text-[12px] text-ink-muted">Configured connectors running in this workspace — select one in the sidebar to open its tools.</p>
          {data.instances.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-outline/60 px-4 py-6 text-center text-[13px] text-ink-muted">
              No connector instances yet — pick a template above.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data.instances.map((inst) => {
                const template = data.templates.find((t) => t.id === inst.templateId);
                return (
                  <li key={inst.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(inst)}
                      className="flex w-full items-center gap-3 rounded-lg border border-outline/60 bg-surface px-4 py-3 text-left transition-colors hover:border-outline-strong"
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${!inst.enabled ? "bg-outline-strong" : inst.healthStatus === "error" ? "bg-destructive" : inst.healthStatus === "ok" ? "bg-emerald-500" : "bg-warning"}`}
                        title={inst.healthError ?? inst.healthStatus ?? "not checked"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold">{inst.name}</span>
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">{template?.name ?? inst.templateId}</span>
                        </span>
                        {inst.healthError ? <span className="mt-0.5 block truncate text-[11px] text-destructive">{inst.healthError}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

