import { useState, type ReactNode } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, Input } from "@twodb/blocks";
import { errMsg, Field } from "./Ui";

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; submitLabel?: string;
  allowNegative?: boolean; withNote?: boolean; initial?: string; amountLabel?: string;
  extra?: (api: { setExtra: (v: string) => void }) => ReactNode;
  onSubmit: (amount: number, note: string, extra: string) => Promise<unknown>;
}

/** Small reusable "enter an amount (+ note)" dialog: fund an envelope, add to a goal, update a price… */
export function AmountDialog({ open, onOpenChange, title, description, submitLabel = "Save", allowNegative, withNote = true, initial = "", amountLabel = "Amount", extra, onSubmit }: Props) {
  const [amount, setAmount] = useState(initial);
  const [note, setNote] = useState("");
  const [ex, setEx] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = amount !== "" && Number.isFinite(n) && (allowNegative ? n !== 0 : n > 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError("");
          try { await onSubmit(n, note, ex); onOpenChange(false); } catch (er) { setError(errMsg(er)); } finally { setBusy(false); }
        }}>
          {extra?.({ setExtra: setEx })}
          <Field label={amountLabel}><Input autoFocus type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          {withNote ? <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!valid || busy}>{submitLabel}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
