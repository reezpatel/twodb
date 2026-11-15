import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation } from "../../lib/queries";
import { del, patch, post } from "../../lib/api";
import { PALETTE } from "../../lib/meta";
import { errMsg, Field, selectCls } from "../../components/Ui";
import type { Goal } from "../../lib/types";

export function GoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: Goal }) {
  const { spaceId } = useSpace();
  const [name, setName] = useState(goal?.name ?? "");
  const [kind, setKind] = useState(goal?.kind ?? "savings");
  const [target, setTarget] = useState(goal?.targetAmount?.toString() ?? "");
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [color, setColor] = useState(goal?.color ?? PALETTE[4]);
  const [note, setNote] = useState(goal?.note ?? "");
  const [error, setError] = useState("");
  const body = () => ({ name: name.trim(), kind, targetAmount: Number(target), targetDate: date || null, color, note: note.trim() || null });
  const save = useApiMutation(() => (goal ? patch(`/goals/${goal.id}`, body()) : post("/goals", { spaceId, ...body() })), () => onOpenChange(false));
  const remove = useApiMutation(() => del(`/goals/${goal!.id}`), () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <div className="flex gap-3">
            <Field label="Name" className="flex-1"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund, Car, Down payment…" /></Field>
            <Field label="Type" className="w-36"><select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value)}><option value="savings">Savings</option><option value="emergency">Emergency</option><option value="retirement">Retirement</option><option value="other">Other</option></select></Field>
          </div>
          <div className="flex gap-3">
            <Field label="Target amount" className="flex-1"><Input type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label="Target date (optional)" className="flex-1"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <Field label="Note"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label="Colour"><div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`size-6 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />)}</div></Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {goal ? <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => { if (confirm("Delete this goal and its contributions?")) remove.mutate(); }}>Delete</Button> : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !(Number(target) > 0) || save.isPending}>{goal ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
