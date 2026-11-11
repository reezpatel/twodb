import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Textarea } from "@twodb/blocks";
import type { Runner } from "../../../lib/dispatch-client.js";

export interface NewJobDialogProps {
  runners: Runner[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { runnerId: string; resourceId?: string; cwd?: string; command: string }) => Promise<void>;
}

/** Job launcher: pick an online runner, command, optional resourceId. */
export function NewJobDialog(props: NewJobDialogProps) {
  const online = props.runners.filter((r) => r.status === "online");
  const [runnerId, setRunnerId] = useState(online[0]?.name ?? "");
  const [resourceId, setResourceId] = useState("");
  const [cwd, setCwd] = useState("");
  const [command, setCommand] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!runnerId || !command.trim()) return;
    try {
      await props.onCreate({ runnerId, resourceId: resourceId.trim() || undefined, cwd: cwd.trim() || undefined, command });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New job</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="job-runner">Runner</Label>
            <select
              id="job-runner"
              value={runnerId}
              className="h-9 w-full rounded-md border border-outline bg-transparent px-2 text-[13px]"
              onChange={(e) => setRunnerId(e.target.value)}
            >
              {online.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-resource">Resource ID (optional)</Label>
            <Input id="job-resource" value={resourceId} placeholder="batch-7" onChange={(e) => setResourceId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-cwd">Working directory (optional)</Label>
            <Input id="job-cwd" value={cwd} placeholder="/srv/app" className="font-mono text-[12px]" onChange={(e) => setCwd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-cmd">Command</Label>
            <Textarea
              id="job-cmd"
              value={command}
              placeholder="npm run build"
              className="min-h-24 font-mono text-[12px]"
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={props.onClose}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={!runnerId || !command.trim() || props.busy} onClick={() => void submit()}>
              {props.busy ? "Starting…" : "Start job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
