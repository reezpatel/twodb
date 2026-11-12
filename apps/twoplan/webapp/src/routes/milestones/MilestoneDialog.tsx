import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { post } from "../../lib/api";
import { useApiMutation } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { addDays, toIsoDate } from "../../lib/format";
import type { Milestone } from "../../lib/types";

export function MilestoneDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: (m: Milestone) => void }) {
  const { project } = useProjectCtx();
  const [name, setName] = useState(""), [goal, setGoal] = useState("");
  const [start, setStart] = useState(toIsoDate(new Date())), [end, setEnd] = useState(toIsoDate(addDays(new Date(), 13)));
  useEffect(() => { if (open) { setName(""); setGoal(""); } }, [open]);
  const create = useApiMutation(() => post<Milestone>(`/projects/${project.key}/milestones`, { name, goal, startDate: start, endDate: end }), { onSuccess: (m) => { onOpenChange(false); onCreated?.(m); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New milestone</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div><Label>Name</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 12" /></div>
          <div><Label>Goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What do we commit to?" /></div>
          <div className="flex gap-3"><div className="flex-1"><Label>Start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div><div className="flex-1"><Label>End</Label><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div></div>
          {create.error ? <p className="text-sm text-destructive">{(create.error as Error).message}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!name.trim() || end < start || create.isPending}>Create milestone</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
