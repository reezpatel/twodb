import { Loader2, RotateCw } from "lucide-react";
import { ConnectionForm } from "./connection-form";
import { ConnectionUsage } from "./connection-usage";
import { AgentsPanel, InstructionsPanel, MemoriesPanel, SkillsPanel } from "./workspace-panels";
import { useLlm } from "./use-llm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LlmSection() {
  const { providers, connections, modal, setModal, toggle, refreshAll, refreshOne, actionError, onSaved, onDelete } = useLlm();

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
          {connections.data.map((connection) => (
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
              </div>
              <Button variant="ghost" size="sm" title="Refresh models" onClick={() => refreshOne.mutate(connection.id)} disabled={refreshOne.isPending}>
                {refreshOne.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
                Models
              </Button>
              <Switch checked={connection.enabled} onCheckedChange={() => toggle.mutate(connection)} title="Enable / disable" />
              <Button variant="ghost" size="sm" onClick={() => setModal({ mode: "edit", connection })}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(connection)}>
                Delete
              </Button>
            </li>
          ))}
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
    </Tabs>
  );
}
