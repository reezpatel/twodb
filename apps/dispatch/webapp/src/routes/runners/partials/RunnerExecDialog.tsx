import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Textarea } from "@twodb/blocks";
import { dispatchClient, type ExecResult, type Runner } from "../../../lib/dispatch-client.js";

export interface RunnerExecDialogProps {
  runner: Runner;
  onClose: () => void;
}

/** One-shot exec on a runner: type a command, get buffered output back. */
export function RunnerExecDialog(props: RunnerExecDialogProps) {
  const [command, setCommand] = useState("");
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await dispatchClient.exec({ runnerId: props.runner.name, command }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exec on {props.runner.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="exec-cmd">Command</Label>
            <div className="flex gap-2">
              <Input
                id="exec-cmd"
                value={command}
                placeholder="uname -a"
                className="font-mono text-[12px]"
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && command && void run()}
              />
              <Button size="sm" variant="primary" disabled={busy || !command} onClick={() => void run()}>
                {busy ? "Running…" : "Run"}
              </Button>
            </div>
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          {result ? (
            <div className="space-y-2">
              <p className="text-[11px] text-ink-muted">
                exit {result.exitCode} · {result.durationMs}ms
              </p>
              {result.stdout ? (
                <pre className="max-h-72 overflow-auto rounded-md border border-outline bg-surface-muted p-3 text-[11px] leading-relaxed">{result.stdout}</pre>
              ) : null}
              {result.stderr ? (
                <pre className="max-h-40 overflow-auto rounded-md border border-outline border-destructive/40 bg-surface-muted p-3 text-[11px] leading-relaxed text-destructive">{result.stderr}</pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
