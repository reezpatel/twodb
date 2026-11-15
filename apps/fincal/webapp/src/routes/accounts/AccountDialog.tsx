import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Switch } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation } from "../../lib/queries";
import { del, patch, post } from "../../lib/api";
import { ACCOUNT_TYPES, PALETTE } from "../../lib/meta";
import { errMsg, Field, selectCls } from "../../components/Ui";
import type { Account } from "../../lib/types";

export function AccountDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account?: Account }) {
  const { spaceId } = useSpace();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "bank");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [opening, setOpening] = useState(String(account?.openingBalance ?? 0));
  const [limit, setLimit] = useState(account?.creditLimit?.toString() ?? "");
  const [statementDay, setStatementDay] = useState(account?.statementDay?.toString() ?? "");
  const [dueDay, setDueDay] = useState(account?.dueDay?.toString() ?? "");
  const [color, setColor] = useState(account?.color ?? PALETTE[0]);
  const [inNw, setInNw] = useState(account?.includeInNetworth ?? true);
  const [error, setError] = useState("");
  const card = type === "credit_card";

  const body = () => ({
    name: name.trim(), type, institution: institution.trim() || null, openingBalance: Number(opening) || 0, color, includeInNetworth: inNw,
    creditLimit: card && limit ? Number(limit) : null, statementDay: card && statementDay ? Number(statementDay) : null, dueDay: card && dueDay ? Number(dueDay) : null,
  });
  const save = useApiMutation(() => (account ? patch(`/accounts/${account.id}`, body()) : post("/accounts", { spaceId, ...body() })), () => onOpenChange(false));
  const archive = useApiMutation(() => patch(`/accounts/${account!.id}`, { archived: true }), () => onOpenChange(false));
  const remove = useApiMutation(() => del(`/accounts/${account!.id}`), () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <div className="flex gap-3">
            <Field label="Name" className="flex-1"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC Savings" /></Field>
            <Field label="Type" className="w-44"><select className={selectCls} value={type} onChange={(e) => setType(e.target.value as Account["type"])}>{ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          </div>
          <div className="flex gap-3">
            <Field label="Institution" className="flex-1"><Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Optional" /></Field>
            <Field label={card ? "Opening balance (negative = owed)" : "Opening balance"} className="flex-1"><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
          </div>
          {card ? (
            <div className="flex gap-3">
              <Field label="Credit limit" className="flex-1"><Input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
              <Field label="Statement day" className="w-32"><Input type="number" min="1" max="31" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} /></Field>
              <Field label="Due day" className="w-28"><Input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} /></Field>
            </div>
          ) : null}
          <Field label="Colour"><div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={`size-6 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />)}</div></Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={inNw} onCheckedChange={setInNw} />Include in net worth</label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {account ? <>
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete this account? Only possible if it has no transactions.")) remove.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>Delete</Button>
              <Button type="button" variant="ghost" className="mr-auto" onClick={() => archive.mutate()}>Archive</Button>
            </> : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>{account ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
