import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useAccounts, useApiMutation, useCategories, useEnvelopes, usePayees } from "../../lib/queries";
import { del, patch, post } from "../../lib/api";
import { PAY_METHODS } from "../../lib/meta";
import { titleCase, todayIso } from "../../lib/format";
import { errMsg, Field, Segmented, selectCls } from "../../components/Ui";
import type { Txn, TxnKind } from "../../lib/types";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; txn?: Txn; defaults?: Partial<{ kind: TxnKind; accountId: string; toAccountId: string; amount: number }> }

/** Create / edit / delete one transaction. Transfers also cover credit-card bill payments (bank → card). */
export function TxnDialog({ open, onOpenChange, txn, defaults }: Props) {
  const { spaceId } = useSpace();
  const { data: accounts = [] } = useAccounts(spaceId);
  const { data: categories = [] } = useCategories(spaceId);
  const { data: envs } = useEnvelopes(spaceId);
  const { data: lists } = usePayees(spaceId);
  const [kind, setKind] = useState<TxnKind>(txn?.kind ?? defaults?.kind ?? "expense");
  const [amount, setAmount] = useState(txn ? String(txn.amount) : defaults?.amount ? String(defaults.amount) : "");
  const [date, setDate] = useState(txn?.date ?? todayIso());
  const [accountId, setAccountId] = useState(txn?.accountId ?? defaults?.accountId ?? accounts.find((a) => a.type !== "credit_card")?.id ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(txn?.toAccountId ?? defaults?.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(txn?.categoryId ?? "");
  const [payee, setPayee] = useState(txn?.payee ?? "");
  const [method, setMethod] = useState(txn?.method ?? "");
  const [envelopeId, setEnvelopeId] = useState(txn?.envelopeId ?? "");
  const [tags, setTags] = useState((txn?.tags ?? []).join(", "));
  const [note, setNote] = useState(txn?.note ?? "");
  const [error, setError] = useState("");

  const body = () => ({
    accountId, kind, amount: Number(amount), date,
    categoryId: kind === "transfer" ? null : categoryId || null,
    toAccountId: kind === "transfer" ? toAccountId : null,
    payee: payee.trim() || null, note: note.trim() || null, method: method || null,
    envelopeId: kind === "expense" ? envelopeId || null : null,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
  });
  const save = useApiMutation(() => (txn ? patch(`/transactions/${txn.id}`, body()) : post("/transactions", { spaceId, ...body() })), () => onOpenChange(false));
  const remove = useApiMutation(() => del(`/transactions/${txn!.id}`), () => onOpenChange(false));
  const cats = categories.filter((c) => c.kind === (kind === "income" ? "income" : "expense"));
  const valid = Number(amount) > 0 && accountId && (kind !== "transfer" || (toAccountId && toAccountId !== accountId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{txn ? "Edit transaction" : "New transaction"}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <Segmented value={kind} onChange={(k) => { setKind(k); setCategoryId(""); }} options={[{ id: "expense", label: "Expense" }, { id: "income", label: "Income" }, { id: "transfer", label: "Transfer / card payment" }]} />
          <div className="flex gap-3">
            <Field label="Amount" className="flex-1"><Input autoFocus type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
            <Field label="Date" className="w-40"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <div className="flex gap-3">
            <Field label={kind === "transfer" ? "From" : "Account"} className="flex-1">
              <select className={selectCls} value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            </Field>
            {kind === "transfer" ? (
              <Field label="To" className="flex-1">
                <select className={selectCls} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}><option value="">Select…</option>{accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </Field>
            ) : (
              <Field label="Category" className="flex-1">
                <select className={selectCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Uncategorized</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </Field>
            )}
          </div>
          {kind !== "transfer" ? (
            <div className="flex gap-3">
              <Field label={kind === "income" ? "Source" : "Payee"} className="flex-1">
                <Input list="fc-payees" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={kind === "income" ? "Employer, client…" : "Merchant or person"} />
                <datalist id="fc-payees">{lists?.payees.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Method" className="w-40">
                <select className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}><option value="">—</option>{PAY_METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select>
              </Field>
            </div>
          ) : null}
          {kind === "expense" && envs?.items.length ? (
            <Field label="Spend from envelope">
              <select className={selectCls} value={envelopeId} onChange={(e) => setEnvelopeId(e.target.value)}><option value="">None</option>{envs.items.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </Field>
          ) : null}
          <div className="flex gap-3">
            <Field label="Tags" className="flex-1"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" list="fc-tags" /><datalist id="fc-tags">{lists?.tags.map((t) => <option key={t} value={t} />)}</datalist></Field>
            <Field label="Note" className="flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {txn ? <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => { if (confirm("Delete this transaction?")) remove.mutate(); }}>Delete</Button> : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>{txn ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
