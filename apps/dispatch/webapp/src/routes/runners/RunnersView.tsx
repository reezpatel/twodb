import { useEffect, useState } from "react";
import { Card, CardContent, Badge } from "@twodb/blocks";
import type { Runner } from "../../lib/dispatch-client.js";
import { useSharedDispatch } from "../../lib/dispatch-context.js";
import { RunnerCard } from "./partials/RunnerCard.js";
import { RunnerExecDialog } from "./partials/RunnerExecDialog.js";

/**
 * Runners page: every machine registered in this workspace — online status,
 * host metadata, quick one-shot exec, delete (revokes its key).
 */
export function RunnersView() {
  const { runners } = useSharedDispatch();
  const [execFor, setExecFor] = useState<Runner | null>(null);

  useEffect(() => {
    void runners.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {runners.runners.length} runner{runners.runners.length === 1 ? "" : "s"} — machines running two-runner, connected over WebSocket.
        </p>
      </div>
      {runners.error ? <Card><CardContent className="p-4 text-[13px] text-destructive">{runners.error}</CardContent></Card> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {runners.runners.map((r) => (
          <RunnerCard key={r.id} runner={r} busy={runners.busy} onExec={() => setExecFor(r)} onDelete={() => void runners.remove(r.name)} />
        ))}
      </div>
      {execFor ? <RunnerExecDialog runner={execFor} onClose={() => setExecFor(null)} /> : null}
    </div>
  );
}
