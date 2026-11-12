import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { Group, rowCls } from "./parts";
import { TypePicker, PriorityPicker, LabelsPicker } from "../../components/PropertyPickers";
import { del, post } from "../../lib/api";
import { useApiMutation, useTicketTemplates } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import type { Priority } from "../../lib/types";

function TemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { project } = useProjectCtx();
  const [name, setName] = useState(""), [title, setTitle] = useState(""), [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null), [priority, setPriority] = useState<Priority | null>(null), [labelIds, setLabelIds] = useState<string[]>([]);
  const [items, setItems] = useState("");
  const create = useApiMutation(() => post(`/projects/${project.key}/ticket-templates`, { name, title, description, typeId, priority, labelIds, checklist: items.trim() ? [{ title: "Checklist", items: items.split("\n").map((s) => s.trim()).filter(Boolean) }] : [] }), { onSuccess: () => { onOpenChange(false); setName(""); setTitle(""); setDescription(""); setItems(""); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>New ticket template</DialogTitle></DialogHeader>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <div><Label>Template name</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Bug report" /></div>
        <div><Label>Default title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bug: " /></div>
        <RichTextEditor value={description} onChange={setDescription} minimal placeholder="Default description (steps to reproduce, expected…)" />
        <div className="flex flex-wrap gap-1"><TypePicker value={typeId} onChange={setTypeId} /><PriorityPicker value={priority} onChange={setPriority} /><LabelsPicker value={labelIds} onChange={setLabelIds} /></div>
        <div><Label>Checklist items (one per line)</Label><textarea value={items} onChange={(e) => setItems(e.target.value)} rows={3} className="w-full rounded-md border border-outline bg-paper p-2 text-sm" /></div>
        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!name.trim()}>Create template</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

export function TemplatesSettings() {
  const { project } = useProjectCtx();
  const { data = [] } = useTicketTemplates(project.key);
  const [open, setOpen] = useState(false);
  const remove = useApiMutation((id: string) => del(`/projects/${project.key}/ticket-templates/${id}`));
  const saveAs = useApiMutation((name: string) => post(`/projects/${project.key}/save-as-template`, { name }));
  return (
    <>
      <Group title="Ticket templates" hint="Pre-filled tickets for recurring work. Pick one in the New ticket dialog." action={<Button size="sm" onClick={() => setOpen(true)}><Plus />New template</Button>}>
        <div className="flex flex-col gap-1.5">{data.map((t) => <div key={t.id} className={rowCls}><span className="flex-1 truncate text-sm font-medium">{t.name}</span><span className="truncate text-xs text-ink-muted">{t.title}</span><button className="rounded-sm p-1 text-ink-muted hover:text-destructive" aria-label={`Delete ${t.name}`} onClick={() => remove.mutate(t.id)}><Trash2 className="size-3.5" /></button></div>)}{!data.length ? <p className="text-sm text-ink-muted">No templates yet.</p> : null}</div>
      </Group>
      <Group title="Project template" hint="Save this project's statuses, types, labels, custom fields, settings and ticket templates so new projects can start from them.">
        <div><Button variant="secondary" size="sm" onClick={() => { const n = prompt("Template name", `${project.name} template`); if (n?.trim()) saveAs.mutate(n.trim(), { onSuccess: () => alert("Saved. Pick it when creating a new project."), onError: (e) => alert((e as Error).message) }); }}>Save as project template…</Button></div>
      </Group>
      <TemplateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
