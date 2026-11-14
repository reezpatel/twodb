import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import type { DirectoryInfo, ModelInfo } from "../../../lib/artisan-client.js";

export interface DirectoryDialogProps {
  /** When set, we're editing an existing directory; otherwise adding a new one. */
  directory?: DirectoryInfo;
  models: ModelInfo[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    runner: string;
    path: string;
    title?: string;
    defaultModel?: string | null;
    projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean };
  }) => Promise<string | null>;
}

/** Add / edit a project directory: runner + path + title + default model + which
 *  project instruction files (.agents / .claude / AGENTS.md) to load into the agent. */
export function DirectoryDialog(props: DirectoryDialogProps) {
  const d = props.directory;
  const [runner, setRunner] = useState(d?.runner ?? "divine");
  const [path, setPath] = useState(d?.path ?? "");
  const [title, setTitle] = useState(d?.title ?? "");
  const [model, setModel] = useState(d?.defaultModel ?? props.models[0]?.id ?? "");
  const [loadAgents, setLoadAgents] = useState(d?.projectSettings?.loadAgents ?? true);
  const [loadClaude, setLoadClaude] = useState(d?.projectSettings?.loadClaude ?? false);
  const [loadAgentsMd, setLoadAgentsMd] = useState(d?.projectSettings?.loadAgentsMd ?? true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!model && props.models[0]) setModel(props.models[0].id);
  }, [props.models, model]);

  const submit = async () => {
    setError(null);
    if (!d && (!runner || !path.trim())) {
      setError("runner and directory path are required");
      return;
    }
    try {
      await props.onSave({
        runner,
        path: path.trim(),
        title: title.trim() || undefined,
        defaultModel: model || null,
        projectSettings: { loadAgents, loadClaude, loadAgentsMd },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{d ? "Edit directory" : "Add directory"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Runner</Label>
              <Input value={runner} disabled={Boolean(d)} onChange={(e) => setRunner(e.target.value)} placeholder="divine" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Directory path</Label>
              <Input value={path} disabled={Boolean(d)} onChange={(e) => setPath(e.target.value)} placeholder="/path/to/project" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={path.split("/").filter(Boolean).pop() ?? "My project"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Default model</Label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="h-9 rounded-md border border-outline bg-paper px-2 text-[13px] outline-none">
              {props.models.map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 border-t border-outline pt-3">
            <Label className="text-[12px]">Project instruction files</Label>
            <label className="flex items-center gap-2 text-[12px] text-ink-muted">
              <Checkbox checked={loadAgents} onCheckedChange={(v) => setLoadAgents(Boolean(v))} />
              Load <code className="font-mono">.agents/AGENTS.md</code> (default)
            </label>
            <label className="flex items-center gap-2 text-[12px] text-ink-muted">
              <Checkbox checked={loadClaude} onCheckedChange={(v) => setLoadClaude(Boolean(v))} />
              Load <code className="font-mono">.claude/CLAUDE.md</code>
            </label>
            <label className="flex items-center gap-2 text-[12px] text-ink-muted">
              <Checkbox checked={loadAgentsMd} onCheckedChange={(v) => setLoadAgentsMd(Boolean(v))} />
              Load <code className="font-mono">AGENTS.md</code>
            </label>
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={props.busy}>{d ? "Save" : "Add directory"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
