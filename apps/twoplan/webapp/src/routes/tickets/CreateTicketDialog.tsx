import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { post } from "../../lib/api";
import { useApiMutation, useTicketTemplates } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { AssigneePicker, DateField, EpicPicker, LabelsPicker, MilestonePicker, PriorityPicker, StatusPicker, TypePicker } from "../../components/PropertyPickers";
import type { Priority, Ticket } from "../../lib/types";

export interface TicketDefaults { statusId?: string; epicId?: string | null; milestoneId?: string | null; parentId?: string | null; assigneeUserId?: string | null; priority?: Priority | null }

/** Quick-create. Used from the tickets page, epic/milestone pages and as "add sub-task". */
export function CreateTicketDialog({ open, onOpenChange, defaults = {} }: { open: boolean; onOpenChange: (o: boolean) => void; defaults?: TicketDefaults }) {
  const { project, config } = useProjectCtx();
  const nav = useNavigate();
  const { data: templates = [] } = useTicketTemplates(project.key);
  const firstStatus = config.statuses.find((s) => s.category === "backlog" || s.category === "todo")?.id ?? config.statuses[0]?.id ?? "";
  const blank = () => ({ title: "", description: "", statusId: defaults.statusId ?? firstStatus, priority: defaults.priority ?? (null as Priority | null), assigneeUserId: defaults.assigneeUserId ?? (null as string | null), typeId: null as string | null, epicId: defaults.epicId ?? (null as string | null), milestoneId: defaults.milestoneId ?? (null as string | null), labelIds: [] as string[], dueDate: null as string | null, templateId: "" });
  const [f, setF] = useState(blank);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setF(blank()); setError(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setF((s) => ({ ...s, [k]: v }));

  const create = useApiMutation(
    () => post<Ticket>(`/projects/${project.key}/tickets`, { ...f, templateId: f.templateId || undefined, parentId: defaults.parentId ?? undefined, description: f.description || undefined }),
    { onSuccess: (t) => { if (more) { setF({ ...blank(), statusId: f.statusId, epicId: f.epicId, milestoneId: f.milestoneId }); } else { onOpenChange(false); nav(`/p/${project.key}/t/${t.identifier}`); } } },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{defaults.parentId ? "New sub-task" : `New ticket in ${project.key}`}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); create.mutate(undefined, { onError: (er) => setError((er as Error).message) }); }}>
          <Input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ticket title" className="text-base" />
          <RichTextEditor value={f.description} onChange={(v) => set("description", v)} placeholder="Add a description…" minimal />
          <div className="flex flex-wrap items-center gap-1">
            <StatusPicker value={f.statusId} onChange={(v) => set("statusId", v)} />
            <PriorityPicker value={f.priority} onChange={(v) => set("priority", v)} />
            <AssigneePicker value={f.assigneeUserId} onChange={(v) => set("assigneeUserId", v)} />
            <TypePicker value={f.typeId} onChange={(v) => set("typeId", v)} />
            <EpicPicker value={f.epicId} onChange={(v) => set("epicId", v)} />
            <MilestonePicker value={f.milestoneId} onChange={(v) => set("milestoneId", v)} />
            <LabelsPicker value={f.labelIds} onChange={(v) => set("labelIds", v)} />
            <DateField value={f.dueDate} onChange={(v) => set("dueDate", v)} label="Due date" />
          </div>
          {templates.length ? (
            <select className="h-8 w-56 rounded-md border border-outline bg-paper px-2 text-sm" value={f.templateId} onChange={(e) => set("templateId", e.target.value)}>
              <option value="">No template</option>{templates.map((t) => <option key={t.id} value={t.id}>Template: {t.name}</option>)}
            </select>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-ink-muted"><Checkbox checked={more} onCheckedChange={(v) => setMore(v === true)} />Create more</label>
            <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={(!f.title.trim() && !f.templateId) || create.isPending}>Create ticket</Button></div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
