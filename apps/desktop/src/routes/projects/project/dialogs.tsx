import { useState } from "react";
import type { ProjectDetail, TicketPriority, TicketType } from "../use-projects";
import { useProjectMutation } from "../use-projects";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function NewSprintDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const create = useProjectMutation(
    (b: { name: string; startDate?: string; endDate?: string }) =>
      api(`/api/projects/projects/${projectId}/sprints`, { method: "POST", body: JSON.stringify(b) }),
    [projectId],
  );
  const submit = async () => {
    await create.mutateAsync({ name: name.trim(), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) });
    setName("");
    setStartDate("");
    setEndDate("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New sprint</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 pt-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 12" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || create.isPending} onClick={() => void submit()}>
              Create sprint
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NewTicketDialog({
  open,
  onClose,
  detail,
  subprojectId,
  sprintId,
  backlog,
  sprintName,
}: {
  open: boolean;
  onClose: () => void;
  detail: ProjectDetail;
  subprojectId?: string;
  sprintId?: string;
  backlog: boolean;
  sprintName?: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TicketType>("task");
  const [priority, setPriority] = useState<TicketPriority>("none");
  const [estimate, setEstimate] = useState("");
  const [sub, setSub] = useState(subprojectId ?? detail.subprojects[0]?.id ?? "");
  const create = useProjectMutation(
    (b: Record<string, unknown>) => api(`/api/projects/projects/${detail.project.id}/tickets`, { method: "POST", body: JSON.stringify(b) }),
    [detail.project.id],
  );
  const submit = async () => {
    await create.mutateAsync({
      title: title.trim(),
      description,
      type,
      priority,
      subprojectId: subprojectId ?? sub,
      inBacklog: backlog,
      ...(sprintId ? { sprintId } : {}),
      ...(estimate ? { estimate: Number(estimate) } : {}),
    });
    setTitle("");
    setDescription("");
    setEstimate("");
    setPriority("none");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            New ticket <span className="text-muted-foreground text-sm font-normal">· {sprintName ?? "Backlog"}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 pt-2">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Add more context…" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["task", "feature", "bug", "issue", "chore", "epic"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["none", "low", "medium", "high", "urgent"].map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Estimate (pts)">
              <Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="—" />
            </Field>
          </div>
          {!subprojectId && detail.subprojects.length > 1 && (
            <Field label="Subproject">
              <Select value={sub} onValueChange={setSub}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {detail.subprojects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!title.trim() || create.isPending} onClick={() => void submit()}>
              Create ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
