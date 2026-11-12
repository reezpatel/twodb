import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { artisanClient, type SkillInfo } from "../../../lib/artisan-client.js";

export interface SkillDialogProps {
  skill: SkillInfo | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Create/edit a skill: name, description, content, directory pin, tags. */
export function SkillDialog(props: SkillDialogProps) {
  const editing = props.skill;
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [content, setContent] = useState((editing as SkillInfo & { content?: string })?.content ?? "");
  const [directory, setDirectory] = useState(editing?.directory ?? "");
  const [tags, setTags] = useState((editing?.tags ?? ["default"]).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim() || !content.trim()) {
      setError("name and content are required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        content,
        directory: directory.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (editing) await artisanClient.updateSkill(editing.id, body);
      else await artisanClient.createSkill(body);
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
          <DialogTitle>{editing ? `Edit ${editing.name}` : "New skill"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name (what the agent calls)</Label>
              <Input value={name} placeholder="release-checklist" className="font-mono text-[12px]" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Directory pin (empty = whole space)</Label>
              <Input value={directory} placeholder="/srv/api" className="font-mono text-[12px]" onChange={(e) => setDirectory(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (one line, shown in the system prompt)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma-separated; "default" = always visible)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} className="font-mono text-[12px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Content (the full skill, loaded by read_skill)</Label>
            <textarea
              value={content}
              rows={10}
              className="w-full resize-none rounded-md border border-outline bg-paper px-2.5 py-2 font-mono text-[12px] outline-none"
              onChange={(e) => setContent(e.target.value)}
            />
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
