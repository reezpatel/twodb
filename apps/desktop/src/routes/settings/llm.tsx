import { FlaskConical, Loader2, RotateCw, Table2 } from "lucide-react";
import { useState } from "react";
import { ConnectionForm } from "./connection-form";
import { ConnectionModelsDialog } from "./connection-models-dialog";
import { ConnectionUsage } from "./connection-usage";
import { AgentsPanel, InstructionsPanel, MemoriesPanel, SkillsPanel } from "./workspace-panels";
import { useLlm, type ConnectionTestResult } from "./use-llm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function LlmSection() {
  const { providers, connections, modal, setModal, toggle, refreshAll, refreshOne, testConnection, actionError, onSaved, onDelete, modelsFor, setModelsFor, connectionModels } = useLlm();
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult | "pending">>({});

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  return (
    <Tabs defaultValue="connections" className="max-w-2xl">
      <TabsList>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="agents">Agents</TabsTrigger>
        <TabsTrigger value="memories">Memories</TabsTrigger>
        <TabsTrigger value="instructions">Instructions</TabsTrigger>
      </TabsList>

      <TabsContent value="connections" className="flex flex-col gap-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">LLM connections</h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refreshAll.mutate()} disabled={refreshAll.isPending}>
              {refreshAll.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
              Refresh all models
            </Button>
            <Button size="sm" onClick={() => setModal({ mode: "create" })}>
              Add connection
            </Button>
          </div>
        </div>

        {actionError && (
          <p className="text-destructive text-sm" role="alert">
            {actionError}
          </p>
        )}

        {connections.isPending ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : connections.data && connections.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {connections.data.map((connection) => {
              const testResult = testResults[connection.id];
              return (
                <li key={connection.id} className="bg-card flex flex-row items-center gap-3 rounded-xl border p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {connection.name}
                      <Badge variant={connection.enabled ? "success" : "secondary"} className="text-[10px]">
                        {connection.enabled ? "on" : "off"}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">{providerLabel(connection.provider)}</div>
                    <ConnectionUsage connectionId={connection.id} />
                    {testResult === "pending" && (
                      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                        <Loader2 size={11} className="animate-spin" /> testing…
                      </p>
                    )}
                    {testResult && testResult !== "pending" && (
                      <p className={cn("mt-1 truncate text-xs", testResult.ok ? "text-success" : "text-destructive")}>
                        {testResult.ok
                          ? `✓ ${testResult.ms}ms · ${testResult.model} · “${testResult.reply || "(empty)"}”`
                          : `✗ ${testResult.error ?? "test failed"}`}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Send a tiny round-trip through this connection"
                    disabled={testConnection.isPending}
                    onClick={() => {
                      setTestResults((r) => ({ ...r, [connection.id]: "pending" }));
                      testConnection.mutate(connection.id, {
                        onSuccess: (result) => setTestResults((r) => ({ ...r, [connection.id]: result })),
                        onError: (e) => setTestResults((r) => ({ ...r, [connection.id]: { ok: false, model: "", ms: 0, error: (e as Error).message } })),
                      });
                    }}
                  >
                    {testConnection.isPending && testResult === "pending" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" title="Show stored models" onClick={() => setModelsFor(connection)}>
                    <Table2 />
                    Models
                  </Button>
                  <Button variant="ghost" size="sm" title="Refresh models from provider" onClick={() => refreshOne.mutate(connection.id)} disabled={refreshOne.isPending}>
                    {refreshOne.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
                    Sync
                  </Button>
                  <Switch checked={connection.enabled} onCheckedChange={() => toggle.mutate(connection)} title="Enable / disable" />
                  <Button variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", connection })}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(connection)}>
                    Delete
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground text-sm">
                No connections yet. Add one to start using LLM features — multiple connections per provider are supported.
              </p>
            </CardContent>
          </Card>
        )}

        <Dialog open={modal.mode !== "closed"} onOpenChange={(open) => !open && setModal({ mode: "closed" })}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{modal.mode === "edit" ? "Edit connection" : "Add connection"}</DialogTitle>
              <DialogDescription>credentials stay on your server</DialogDescription>
            </DialogHeader>
            {modal.mode !== "closed" && (
              <ConnectionForm
                key={modal.mode === "edit" ? modal.connection.id : "create"}
                providers={providers}
                connection={modal.mode === "edit" ? modal.connection : undefined}
                onSaved={onSaved}
                onCancel={() => setModal({ mode: "closed" })}
              />
            )}
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="skills" className="pt-2">
        <SkillsPanel />
      </TabsContent>
      <TabsContent value="agents" className="pt-2">
        <AgentsPanel />
      </TabsContent>
      <TabsContent value="memories" className="pt-2">
        <MemoriesPanel />
      </TabsContent>
      <TabsContent value="instructions" className="pt-2">
        <InstructionsPanel />
      </TabsContent>

      <ConnectionModelsDialog connection={modelsFor} models={connectionModels.data} pending={connectionModels.isPending} onClose={() => setModelsFor(null)} />
    </Tabs>
  );
}
