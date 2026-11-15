import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation, useHoldingTrades } from "../../lib/queries";
import { post } from "../../lib/api";
import { dateLabel, todayIso } from "../../lib/format";
import { errMsg, Field, Segmented } from "../../components/Ui";
import type { Holding } from "../../lib/types";

/** Buy / sell with weighted-average cost, plus the trade history of the holding. */
export function TradeDialog({ holding, onClose }: { holding: Holding; onClose: () => void }) {
  const { money, precise } = useSpace();
  const { data: trades } = useHoldingTrades(holding.id);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(holding.currentPrice?.toString() ?? "");
  const [fees, setFees] = useState("");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState("");
  const run = useApiMutation(() => post(`/holdings/${holding.id}/trade`, { side, quantity: Number(quantity), price: Number(price), fees: fees ? Number(fees) : undefined, date }), onClose);
  const valid = Number(quantity) > 0 && price !== "" && Number(price) >= 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{holding.name}</DialogTitle><DialogDescription>Holding {holding.quantity} {holding.unit ?? ""} at avg {precise(holding.avgCost)}</DialogDescription></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); run.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <Segmented value={side} onChange={setSide} options={[{ id: "buy", label: "Buy / SIP" }, { id: "sell", label: "Sell" }]} />
          <div className="flex gap-3">
            <Field label="Quantity" className="flex-1"><Input autoFocus type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
            <Field label="Price / NAV" className="flex-1"><Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          </div>
          <div className="flex gap-3">
            <Field label="Fees (optional)" className="flex-1"><Input type="number" min="0" value={fees} onChange={(e) => setFees(e.target.value)} /></Field>
            <Field label="Date" className="flex-1"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          {valid ? <p className="text-xs text-ink-muted">Trade value {money(Number(quantity) * Number(price))}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {trades?.length ? (
            <ul className="max-h-40 divide-y divide-outline overflow-auto rounded-md border border-outline text-xs">
              {trades.map((t) => <li key={t.id} className="flex gap-2 px-2 py-1.5"><span className="w-16 text-ink-muted">{dateLabel(t.date)}</span><span className={t.side === "buy" ? "text-success" : "text-destructive"}>{t.side}</span><span className="flex-1">{t.quantity} @ {precise(t.price)}</span></li>)}
            </ul>
          ) : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!valid || run.isPending}>{side === "buy" ? "Record buy" : "Record sell"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Update the current price / NAV of every priced holding in one go. */
export function PricesDialog({ holdings, onClose }: { holdings: Holding[]; onClose: () => void }) {
  const { spaceId } = useSpace();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(holdings.map((h) => [h.id, h.currentPrice?.toString() ?? ""])));
  const [error, setError] = useState("");
  const run = useApiMutation(() => post("/holdings/prices", { spaceId, prices: holdings.filter((h) => vals[h.id] !== "" && Number(vals[h.id]) !== h.currentPrice).map((h) => ({ id: h.id, price: Number(vals[h.id]) })) }), onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Update prices</DialogTitle><DialogDescription>Enter today's price / NAV. Fincal doesn't fetch live quotes.</DialogDescription></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); run.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <ul className="max-h-80 space-y-2 overflow-auto">
            {holdings.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{h.name}{h.symbol ? <span className="text-ink-muted"> · {h.symbol}</span> : null}</span><Input className="h-8 w-32" type="number" min="0" step="any" value={vals[h.id]} onChange={(e) => setVals({ ...vals, [h.id]: e.target.value })} /></li>
            ))}
          </ul>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={run.isPending}>Save prices</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
