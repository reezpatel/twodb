import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import type { ModelInfo, RunnerInfo } from "../../../lib/artisan-client.js";

export interface NewSessionDialogProps {
  models: ModelInfo[];
  runners: RunnerInfo[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { runner: string; directory: string; model: string; title?: string; message?: string }) => Promise<string | null>;
}

/** New session: pick runner + directory + model; optional opening message. */
export function NewSessionDialog(props: NewSessionDialogProps) {
  const [runner, setRunner] = useState(props.runners[0]?.name ?? "");
  const [directory, setDirectory] = useState("");
  const [model, setModel] = useState(props.models[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runner && props.runners[0]) setRunner(props.runners[0].name);
    if (!model && props.models[0]) setModel(props.models[0].id);
  }, [props.runners, props.models, runner, model]);

  const submit = async () => {
    setError(null);
    if (!runner || !directory.trim()) {
      setError("runner and directory are required");
      return;
    }
    try {
      await props.onCreate({
        runner,
        directory: directory.trim(),
        model,
        title: title.trim() || undefined,
        message: message.trim() || undefined,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New session</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Runner</Label>
              <select
                value={runner}
                onChange={(e) => setRunner(e.target.value)}
                className="h-9 w-full rounded-md border border-outline bg-paper px-2.5 text-[13px]"
              >
                {props.runners.map((r) => (
                  <option key={r.name} value={r.name}>{r.name} · {r.kind}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Directory (on the runner)</Label>
              <Input value={directory} placeholder="/home/user/project" className="font-mono text-[12px]" onChange={(e) => setDirectory(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full rounded-md border border-outline bg-paper px-2.5 font-mono text-[12px]"
            >
              {props.models.slice(0, 400).map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Title (optional — the agent can name it later)</Label>
            <Input value={title} placeholder="refactor auth" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Opening message (optional)</Label>
            <textarea
              value={message}
              rows={3}
              placeholder="What should this session do?"
              className="w-full resize-none rounded-md border border-outline bg-paper px-2.5 py-2 text-[13px] outline-none"
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={props.onClose}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={props.busy} onClick={() => void submit()}>
              {props.busy ? "Creating…" : "Create session"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
