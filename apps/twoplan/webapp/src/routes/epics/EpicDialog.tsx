import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { post } from "../../lib/api";
import { useApiMutation } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { AssigneePicker, DateField, PriorityPicker } from "../../components/PropertyPickers";
import { EPIC_STATUSES } from "../../lib/meta";
import { selectCls } from "../projects/CreateProjectDialog";
import type { Epic, EpicStatus, Priority } from "../../lib/types";

export function EpicDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (e: Epic) => void }) {
  const { project } = useProjectCtx();
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [status, setStatus] = useState<EpicStatus>("planned");
  const [owner, setOwner] = useState<string | null>(null), [priority, setPriority] = useState<Priority | null>(null);
  const [start, setStart] = useState<string | null>(null), [target, setTarget] = useState<string | null>(null);
  const create = useApiMutation(() => post<Epic>(`/projects/${project.key}/epics`, { title, description, status, ownerUserId: owner, priority, startDate: start, targetDate: target }),
    { onSuccess: (e) => { onOpenChange(false); setTitle(""); setDescription(""); onCreated?.(e); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>New epic</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Epic title" />
          <RichTextEditor value={description} onChange={setDescription} minimal placeholder="What is this epic about?" />
          <div className="flex flex-wrap items-center gap-1">
            <div><Label className="sr-only">Status</Label><select className={`${selectCls} h-8 w-36`} value={status} onChange={(e) => setStatus(e.target.value as EpicStatus)}>{EPIC_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <PriorityPicker value={priority} onChange={setPriority} /><AssigneePicker value={owner} onChange={setOwner} />
            <DateField value={start} onChange={setStart} label="Start date" /><DateField value={target} onChange={setTarget} label="Target date" />
          </div>
          {create.error ? <p className="text-sm text-destructive">{(create.error as Error).message}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!title.trim() || create.isPending}>Create epic</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
