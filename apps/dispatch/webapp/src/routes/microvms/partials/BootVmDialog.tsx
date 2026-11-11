import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import type { Runner } from "../../../lib/dispatch-client.js";

export interface BootVmDialogProps {
  runners: Runner[];
  busy: boolean;
  onClose: () => void;
  onBoot: (input: { runnerId: string; identifier: string; memMb?: number; vcpu?: number }) => Promise<void>;
}

/** Boot/resume launcher: identifier is the identity — same id resumes /app. */
export function BootVmDialog(props: BootVmDialogProps) {
  const [runnerId, setRunnerId] = useState(props.runners[0]?.name ?? "");
  const [identifier, setIdentifier] = useState("");
  const [memMb, setMemMb] = useState("512");
  const [vcpu, setVcpu] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!runnerId || !identifier.trim()) return;
    try {
      await props.onBoot({
        runnerId,
        identifier: identifier.trim(),
        memMb: Number(memMb) || undefined,
        vcpu: Number(vcpu) || undefined,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Boot microvm</DialogTitle>
        </DialogHeader>
        {props.runners.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-muted">
              No online microvm-host runners. Start two-runner with --microvm on a machine with /dev/kvm.
            </p>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={props.onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="vm-runner">Runner</Label>
              <select
                id="vm-runner"
                value={runnerId}
                className="h-9 w-full rounded-md border border-outline bg-transparent px-2 text-[13px]"
                onChange={(e) => setRunnerId(e.target.value)}
              >
                {props.runners.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vm-identifier">Identifier</Label>
              <Input
                id="vm-identifier"
                value={identifier}
                placeholder="build-env (same id = resume with /app)"
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="vm-mem">Memory (MB)</Label>
                <Input id="vm-mem" value={memMb} onChange={(e) => setMemMb(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="vm-vcpu">vCPUs</Label>
                <Input id="vm-vcpu" value={vcpu} onChange={(e) => setVcpu(e.target.value)} />
              </div>
            </div>
            {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={props.onClose}>Cancel</Button>
              <Button size="sm" variant="primary" disabled={!identifier.trim() || props.busy} onClick={() => void submit()}>
                {props.busy ? "Booting…" : "Boot"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
