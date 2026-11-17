import { useParams } from "react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@twodb/blocks";
import type { Runner } from "../../lib/dispatch-client.js";
import { useSharedDispatch } from "../../lib/dispatch-context.js";
import { RunnersTable } from "./partials/RunnersTable.js";
import { RunnerExecDialog } from "./partials/RunnerExecDialog.js";

/**
 * Runners page: every machine registered in this workspace — online status,
 * host metadata, quick one-shot exec, delete (revokes its key).
 */
export function RunnersView() {
  const { runners } = useSharedDispatch();
  const { name } = useParams();
  const shown = name ? runners.runners.filter((r) => r.name === name) : runners.runners;
  const [execFor, setExecFor] = useState<Runner | null>(null);

  useEffect(() => {
    void runners.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] text-ink-muted">
          Machines connected to run your jobs.
        </p>
      </div>
      {runners.error ? <Card><CardContent className="p-4 text-[13px] text-destructive">{runners.error}</CardContent></Card> : null}
      <RunnersTable runners={shown} busy={runners.busy} onExec={setExecFor} onDelete={(r) => void runners.remove(r.name)} />
      {execFor ? <RunnerExecDialog runner={execFor} onClose={() => setExecFor(null)} /> : null}
    </div>
  );
}
