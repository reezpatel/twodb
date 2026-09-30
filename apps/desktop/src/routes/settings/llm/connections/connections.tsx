import { EllipsisVertical, FlaskConical, Gauge, Loader2, Pencil, RotateCw, Table2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConnectionForm } from "./connection-form";
import { ConnectionModelsDialog } from "./connection-models-dialog";
import { ConnectionQuotas } from "./connection-quotas";
import { ConnectionUsage } from "./connection-usage";
import { useLlm, type ConnectionTestResult } from "./use-llm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProviderLogo } from "@/components/provider-logo";
import { cn } from "@/lib/utils";

export function ConnectionsSection() {
  const {
    providers,
    connections,
    modal,
    setModal,
    refreshAll,
    refreshOne,
    refreshAllQuotas,
    testConnection,
    actionError,
    onSaved,
    onDelete,
    modelsFor,
    setModelsFor,
    connectionModels,
  } = useLlm();
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult | "pending">>({});

  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">LLM connections</h3>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Connection list actions">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled={refreshAllQuotas.isPending || (connections.data ?? []).length === 0} onClick={() => refreshAllQuotas.mutate()}>
                {refreshAllQuotas.isPending ? <Loader2 className="animate-spin" /> : <Gauge />}
                Refresh quotas
              </DropdownMenuItem>
              <DropdownMenuItem disabled={refreshAll.isPending} onClick={() => refreshAll.mutate()}>
                {refreshAll.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
                Refresh all models
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <ul className="flex flex-col gap-4">
          {connections.data.map((connection) => {
            const testResult = testResults[connection.id];
            return (
              <li key={connection.id} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-lg border">
                    <ProviderLogo provider={connection.provider} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{connection.name}</div>
                    <div className="text-muted-foreground truncate text-xs">{providerLabel(connection.provider)}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Connection actions">
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        disabled={testConnection.isPending}
                        onClick={() => {
                          setTestResults((r) => ({ ...r, [connection.id]: "pending" }));
                          testConnection.mutate(connection.id, {
                            onSuccess: (result) => setTestResults((r) => ({ ...r, [connection.id]: result })),
                            onError: (e) =>
                              setTestResults((r) => ({
                                ...r,
                                [connection.id]: { ok: false, model: "", ms: 0, error: (e as Error).message },
                              })),
                          });
                        }}
                      >
                        {testConnection.isPending && testResult === "pending" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                        Test
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setModelsFor(connection)}>
                        <Table2 />
                        Models
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={refreshOne.isPending} onClick={() => refreshOne.mutate(connection.id)}>
                        {refreshOne.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
                        Sync
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setModal({ mode: "edit", connection })}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(connection)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div>
                  <ConnectionUsage connectionId={connection.id} />
                  <ConnectionQuotas connectionId={connection.id} />
                  {testResult === "pending" && (
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <Loader2 size={11} className="animate-spin" /> testing…
                    </p>
                  )}
                  {testResult && testResult !== "pending" && (
                    <p className={cn("mt-1 truncate text-xs", testResult.ok ? "text-success" : "text-destructive")}>
                      {testResult.ok
                        ? `✓ ${testResult.ms}ms · ${testResult.model}${testResult.tried?.length ? ` · after ${testResult.tried.map((t) => t.model).join(", ")} failed` : ""} · “${testResult.reply || "(empty)"}”`
                        : `✗ ${testResult.error ?? "test failed"}${
                            testResult.tried && testResult.tried.length > 1
                              ? ` · also failed: ${testResult.tried
                                  .slice(0, -1)
                                  .map((t) => t.model)
                                  .join(", ")}`
                              : ""
                          }`}
                    </p>
                  )}
                </div>
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

      <ConnectionModelsDialog connection={modelsFor} models={connectionModels.data} pending={connectionModels.isPending} onClose={() => setModelsFor(null)} />
    </div>
  );
}
