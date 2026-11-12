import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { artisanClient, type AgentInfo } from "../../../lib/artisan-client.js";

const TOOL_BELT = [
  "read_file", "write_file", "update_file", "remove_file", "exec",
  "job_start", "job_logs", "job_status", "job_input", "job_terminate",
  "list_subagents", "invoke_subagent", "check_subagent_status",
  "get_plan", "update_plan", "set_session_name", "read_skill", "ask_user",
];

export interface AgentDialogProps {
  agent: AgentInfo | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Create/edit an agent: type, instruction, model, tool allowlist, tags,
 *  pinned runner+directory (personas). Empty tool list = full belt. */
export function AgentDialog(props: AgentDialogProps) {
  const editing = props.agent;
  const [type, setType] = useState(editing?.type ?? "sub_agent");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [instruction, setInstruction] = useState((editing as AgentInfo & { instruction?: string })?.instruction ?? "");
  const [model, setModel] = useState(editing?.model ?? "");
  const [tools, setTools] = useState<string[]>(editing?.tools ?? []);
  const [tags, setTags] = useState((editing?.tags ?? ["default"]).join(", "));
  const [runner, setRunner] = useState(editing?.runner ?? "");
  const [directory, setDirectory] = useState(editing?.directory ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleTool = (t: string) => {
    setTools((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const save = async () => {
    setError(null);
    if (!name.trim() || !instruction.trim()) {
      setError("name and instruction are required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        type,
        name: name.trim(),
        description: description.trim(),
        instruction: instruction.trim(),
        model: model.trim() || null,
        tools,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        runner: runner.trim() || null,
        directory: directory.trim() || null,
      };
      if (editing) await artisanClient.updateAgent(editing.id, body);
      else await artisanClient.createAgent(body);
      await props.onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "New agent"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                value={type}
                disabled={editing?.type === "directory"}
                onChange={(e) => setType(e.target.value)}
                className="h-9 w-full rounded-md border border-outline bg-paper px-2.5 text-[13px] disabled:opacity-60"
              >
                {["sub_agent", "persona", "collaborator"].map((t) => <option key={t} value={t}>{t}</option>)}
                {editing?.type === "directory" ? <option value="directory">directory</option> : null}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (shown to callers)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Instruction (system prompt)</Label>
            <textarea
              value={instruction}
              rows={5}
              className="w-full resize-none rounded-md border border-outline bg-paper px-2.5 py-2 font-mono text-[12px] outline-none"
              onChange={(e) => setInstruction(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Model (empty = caller's)</Label>
              <Input value={model} placeholder="GLM/glm-4.7" className="font-mono text-[12px]" onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Runner pin</Label>
              <Input value={runner} placeholder="divine" className="font-mono text-[12px]" onChange={(e) => setRunner(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Directory pin</Label>
              <Input value={directory} placeholder="/srv/app" className="font-mono text-[12px]" onChange={(e) => setDirectory(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma-separated; "default" = always visible)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} className="font-mono text-[12px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Tools (none checked = full belt)</Label>
            <div className="grid grid-cols-3 gap-1">
              {TOOL_BELT.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-[11px] font-mono text-ink-muted">
                  <input type="checkbox" checked={tools.includes(t)} onChange={() => toggleTool(t)} className="accent-ink" />
                  {t}
                </label>
              ))}
            </div>
          </div>
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={props.onClose}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
