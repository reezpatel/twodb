import { useEffect, useMemo, useState } from "react";
import { Play, Search } from "lucide-react";
import { Badge, Button, Card, CardContent, Input } from "@twodb/blocks";
import { useNavigate } from "react-router";
import { useSharedDispatch } from "../../lib/dispatch-context.js";
import { JobsTable } from "./partials/JobsTable.js";
import { NewJobDialog } from "./partials/NewJobDialog.js";

/**
 * Jobs page: live table of every job in the workspace with runner/resource
 * filters, plus a "New job" launcher. Click a row to open the detail view
 * (live tail + stdin feed).
 */
export function JobsView() {
  const { runners, jobs } = useSharedDispatch();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [runnerFilter, setRunnerFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filter = useMemo(
    () => ({
      runnerId: runnerFilter || undefined,
      resourceId: resourceFilter || undefined,
      status: statusFilter || undefined,
    }),
    [runnerFilter, resourceFilter, statusFilter],
  );

  useEffect(() => {
    void jobs.refresh();
    void runners.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => setNewOpen(true)}>
          <Play className="size-3.5" />
          New job
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
            <Input
              value={runnerFilter}
              placeholder="runner"
              className="h-8 w-28 pl-8 text-[12px]"
              onChange={(e) => setRunnerFilter(e.target.value)}
            />
          </div>
          <Input
            value={resourceFilter}
            placeholder="resourceId"
            className="h-8 w-32 text-[12px]"
            onChange={(e) => setResourceFilter(e.target.value)}
          />
          <select
            value={statusFilter}
            className="h-8 rounded-md border border-outline bg-transparent px-2 text-[12px]"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">all statuses</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="terminated">terminated</option>
          </select>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <JobsTable jobs={jobs.jobs} onOpen={(id) => navigate(`/jobs/${id}`)} />
        </CardContent>
      </Card>
      {newOpen ? (
        <NewJobDialog
          runners={runners.runners}
          busy={jobs.busy}
          onClose={() => setNewOpen(false)}
          onCreate={async (input) => {
            const job = await jobs.create(input);
            setNewOpen(false);
            navigate(`/jobs/${job.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
