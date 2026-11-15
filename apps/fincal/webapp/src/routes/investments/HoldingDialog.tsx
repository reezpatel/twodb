import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Switch } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation } from "../../lib/queries";
import { del, patch, post } from "../../lib/api";
import { ASSET_CLASSES, assetMeta } from "../../lib/meta";
import { errMsg, Field, selectCls } from "../../components/Ui";
import type { Holding } from "../../lib/types";

const num = (s: string) => (s === "" ? null : Number(s));

/** Fields adapt to the asset class: priced (stock/fund/metal…), FD, RD, or manual-value (PPF/EPF/NPS/property). */
export function HoldingDialog({ open, onOpenChange, holding, defaultClass }: { open: boolean; onOpenChange: (o: boolean) => void; holding?: Holding; defaultClass?: string }) {
  const { spaceId } = useSpace();
  const [assetClass, setAssetClass] = useState(holding?.assetClass ?? defaultClass ?? "stock");
  const kind = assetMeta(assetClass).kind;
  const [name, setName] = useState(holding?.name ?? "");
  const [symbol, setSymbol] = useState(holding?.symbol ?? "");
  const [institution, setInstitution] = useState(holding?.institution ?? "");
  const [quantity, setQuantity] = useState(holding ? String(holding.quantity) : "");
  const [avgCost, setAvgCost] = useState(holding ? String(holding.avgCost) : "");
  const [price, setPrice] = useState(holding?.currentPrice?.toString() ?? "");
  const [unit, setUnit] = useState(holding?.unit ?? "");
  const [principal, setPrincipal] = useState(holding?.principal?.toString() ?? "");
  const [value, setValue] = useState(holding?.currentValue?.toString() ?? "");
  const [rate, setRate] = useState(holding?.interestRate?.toString() ?? "");
  const [compounding, setCompounding] = useState(String(holding?.compounding ?? 4));
  const [installment, setInstallment] = useState(holding?.installment?.toString() ?? "");
  const [start, setStart] = useState(holding?.startDate ?? "");
  const [maturity, setMaturity] = useState(holding?.maturityDate ?? "");
  const [retirement, setRetirement] = useState(holding?.retirement ?? false);
  const [note, setNote] = useState(holding?.note ?? "");
  const [error, setError] = useState("");

  const body = () => ({
    assetClass, name: name.trim(), institution: institution.trim() || null, retirement, note: note.trim() || null,
    ...(kind === "priced" ? { symbol: symbol.trim() || null, quantity: Number(quantity) || 0, avgCost: Number(avgCost) || 0, currentPrice: num(price), unit: unit.trim() || assetMeta(assetClass).unit || null } : {}),
    ...(kind === "fd" ? { principal: num(principal), interestRate: num(rate), compounding: Number(compounding) || 4, startDate: start || null, maturityDate: maturity || null } : {}),
    ...(kind === "rd" ? { installment: num(installment), interestRate: num(rate), compounding: Number(compounding) || 4, startDate: start || null, maturityDate: maturity || null } : {}),
    ...(kind === "manual" ? { principal: num(principal), currentValue: num(value) } : {}),
  });
  const save = useApiMutation(() => (holding ? patch(`/holdings/${holding.id}`, body()) : post("/holdings", { spaceId, ...body() })), () => onOpenChange(false));
  const archive = useApiMutation(() => patch(`/holdings/${holding!.id}`, { archived: true }), () => onOpenChange(false));
  const remove = useApiMutation(() => del(`/holdings/${holding!.id}`), () => onOpenChange(false));

  const valid = name.trim() && (kind === "priced" ? Number(quantity) >= 0 && quantity !== "" : kind === "fd" ? Number(principal) > 0 && start : kind === "rd" ? Number(installment) > 0 && start : true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{holding ? "Edit investment" : "New investment"}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <div className="flex gap-3">
            <Field label="Type" className="w-48"><select className={selectCls} value={assetClass} disabled={!!holding} onChange={(e) => setAssetClass(e.target.value)}>{ASSET_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
            <Field label="Name" className="flex-1"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "fd" ? "SBI 5-yr FD" : kind === "priced" ? "Infosys / Parag Parikh Flexi Cap / SGB…" : "Name"} /></Field>
          </div>
          {kind === "priced" ? (
            <>
              <div className="flex gap-3">
                <Field label="Symbol / scheme code" className="flex-1"><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="INFY" /></Field>
                <Field label="Unit" className="w-28"><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={assetMeta(assetClass).unit} /></Field>
              </div>
              <div className="flex gap-3">
                <Field label="Quantity" className="flex-1"><Input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
                <Field label="Avg buy price" className="flex-1"><Input type="number" min="0" step="any" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} /></Field>
                <Field label="Current price / NAV" className="flex-1"><Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              </div>
            </>
          ) : null}
          {kind === "fd" || kind === "rd" ? (
            <>
              <div className="flex gap-3">
                {kind === "fd" ? <Field label="Principal" className="flex-1"><Input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></Field>
                  : <Field label="Monthly instalment" className="flex-1"><Input type="number" min="0" value={installment} onChange={(e) => setInstallment(e.target.value)} /></Field>}
                <Field label="Interest rate % p.a." className="w-36"><Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
                <Field label="Compounding / yr" className="w-36"><Input type="number" min="1" value={compounding} onChange={(e) => setCompounding(e.target.value)} /></Field>
              </div>
              <div className="flex gap-3">
                <Field label="Start date" className="flex-1"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
                <Field label="Maturity date" className="flex-1"><Input type="date" value={maturity} onChange={(e) => setMaturity(e.target.value)} /></Field>
              </div>
            </>
          ) : null}
          {kind === "manual" ? (
            <div className="flex gap-3">
              <Field label="Amount invested" className="flex-1"><Input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></Field>
              <Field label="Current value" className="flex-1" hint="Update from your passbook / statement"><Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
            </div>
          ) : null}
          <div className="flex gap-3">
            <Field label="Broker / bank" className="flex-1"><Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Optional" /></Field>
            <Field label="Note" className="flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={retirement} onCheckedChange={setRetirement} />Counts toward retirement corpus</label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {holding ? <>
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete this investment and its trade history?")) remove.mutate(); }}>Delete</Button>
              <Button type="button" variant="ghost" className="mr-auto" onClick={() => archive.mutate()}>Archive (sold / matured)</Button>
            </> : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>{holding ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
