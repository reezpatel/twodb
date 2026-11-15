import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation } from "../../lib/queries";
import { del, patch, post } from "../../lib/api";
import { PALETTE } from "../../lib/meta";
import { errMsg, Field } from "../../components/Ui";
import type { Envelope } from "../../lib/types";

export function EnvelopeDialog({ open, onOpenChange, envelope }: { open: boolean; onOpenChange: (o: boolean) => void; envelope?: Envelope }) {
  const { spaceId } = useSpace();
  const [name, setName] = useState(envelope?.name ?? "");
  const [target, setTarget] = useState(envelope?.target?.toString() ?? "");
  const [fill, setFill] = useState(envelope?.monthlyFill?.toString() ?? "");
  const [color, setColor] = useState(envelope?.color ?? PALETTE[1]);
  const [error, setError] = useState("");
  const body = () => ({ name: name.trim(), color, target: target ? Number(target) : null, monthlyFill: fill ? Number(fill) : null });
  const save = useApiMutation(() => (envelope ? patch(`/envelopes/${envelope.id}`, body()) : post("/envelopes", { spaceId, ...body() })), () => onOpenChange(false));
  const remove = useApiMutation(() => del(`/envelopes/${envelope!.id}`), () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{envelope ? "Edit envelope" : "New envelope"}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday, Car service, Gifts…" /></Field>
          <div className="flex gap-3">
            <Field label="Target (optional)" className="flex-1"><Input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label="Monthly fill (optional)" className="flex-1"><Input type="number" min="0" value={fill} onChange={(e) => setFill(e.target.value)} /></Field>
          </div>
          <Field label="Colour"><div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`size-6 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />)}</div></Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {envelope ? <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => { if (confirm("Delete envelope and its history? Tagged expenses stay.")) remove.mutate(); }}>Delete</Button> : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>{envelope ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
