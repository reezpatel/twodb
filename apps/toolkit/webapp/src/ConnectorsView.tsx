import { Tabs, TabsContent, TabsList, TabsTrigger } from "@twodb/blocks";
import { useState } from "react";
import { type ConnectorInstance, type ConnectorTemplate } from "./lib/toolkit-client.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { InstancePage } from "./InstancePage.js";
import { InstancesTable } from "./partials/InstancesTable.js";
import { TemplatesTable } from "./partials/TemplatesTable.js";

type ConnectorsTab = "active" | "available";

/** Selected tab, remembered across reloads; defaults to Active. */
function useConnectorsTab(): [ConnectorsTab, (t: ConnectorsTab) => void] {
  const [tab, setTab] = useState<ConnectorsTab>(() => (localStorage.getItem("toolkit.connectors.tab") === "available" ? "available" : "active"));
  return [tab, (t) => { setTab(t); localStorage.setItem("toolkit.connectors.tab", t); }];
}

/**
 * Connectors main view: when an instance is selected (sidebar) show its page
 * (tools / broadcasts / queues / settings); otherwise two tabs of
 * Dispatch-style tables: Active (connected instances) and Available (every template to configure).
 */
export function ConnectorsView({ data, active, onSelect, onNewInstance, onEditInstance, onDeleteInstance }: {
  data: ToolkitData;
  active: ConnectorInstance | null;
  onSelect: (instance: ConnectorInstance) => void;
  onNewInstance: (template: ConnectorTemplate) => void;
  onEditInstance: (instance: ConnectorInstance) => void;
  onDeleteInstance: (instance: ConnectorInstance) => void;
}) {
  const [tab, onTab] = useConnectorsTab();
  if (active) return <InstancePage data={data} instance={active} onEdit={() => onEditInstance(active)} onDelete={() => onDeleteInstance(active)} />;

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-6xl">
        <Tabs value={tab} onValueChange={(v) => onTab(v as ConnectorsTab)} className="gap-4">
          <TabsList variant="line" size="md">
            <TabsTrigger value="active" className="px-1 pb-2">
              Active
              <span className="rounded bg-stone px-1.5 py-0.5 text-[10px] text-ink-muted">{data.instances.length}</span>
            </TabsTrigger>
            <TabsTrigger value="available" className="px-1 pb-2">
              Available
              <span className="rounded bg-stone px-1.5 py-0.5 text-[10px] text-ink-muted">{data.templates.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="space-y-3">
            <p className="text-[12px] text-ink-muted">Connected instances running in this workspace — open one for its tools, events and queues.</p>
            <InstancesTable instances={data.instances} templates={data.templates} onOpen={onSelect} onEdit={onEditInstance} onDelete={onDeleteInstance} />
          </TabsContent>
          <TabsContent value="available" className="space-y-3">
            <p className="text-[12px] text-ink-muted">Every connector you can configure — connect one per account or workspace.</p>
            <TemplatesTable templates={data.templates} instances={data.instances} onConnect={onNewInstance} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
