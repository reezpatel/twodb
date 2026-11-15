import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useHoldings } from "../../lib/queries";
import { assetMeta, GROUP_COLORS } from "../../lib/meta";
import { dateLabel, pct } from "../../lib/format";
import { amountCls, EmptyState, Page, PageHeader, Progress, Section, Spinner, Stat, Swatch } from "../../components/Ui";
import { Donut } from "../../components/Charts";
import { HoldingDialog } from "./HoldingDialog";
import { PricesDialog, TradeDialog } from "./TradeDialogs";
import type { Holding } from "../../lib/types";

export function InvestmentsPage() {
  const { spaceId, money, precise } = useSpace();
  const { data, isLoading } = useHoldings(spaceId);
  const [group, setGroup] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [trading, setTrading] = useState<Holding | null>(null);
  const [pricing, setPricing] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data?.summary.byClass ?? []) m.set(c.group, (m.get(c.group) ?? 0) + c.value);
    return [...m].map(([name, value]) => ({ name, value, color: GROUP_COLORS[name] ?? "#9ca3af" }));
  }, [data]);
  if (isLoading || !data) return <Spinner />;
  const s = data.summary;
  const items = data.items.filter((h) => group === "all" || assetMeta(h.assetClass).group === group);
  const priced = data.items.filter((h) => assetMeta(h.assetClass).kind === "priced");
  const upcoming = data.items.filter((h) => h.daysToMaturity !== null && h.daysToMaturity >= 0 && h.daysToMaturity <= 90).sort((a, b) => a.daysToMaturity! - b.daysToMaturity!);

  return (
    <Page wide>
      <PageHeader title="Investments" subtitle="Stocks, mutual funds, metals, FDs, RDs, PPF/EPF/NPS and more"
        actions={<>{priced.length ? <Button variant="ghost" size="sm" onClick={() => setPricing(true)}><RefreshCw />Update prices</Button> : null}<Button size="sm" onClick={() => setCreating(true)}><Plus />Add investment</Button></>} />
      {!data.items.length ? <EmptyState title="No investments yet" hint="Add holdings to see allocation, gains and your total net worth. FDs and RDs are valued automatically from their terms." action={<Button onClick={() => setCreating(true)}>Add your first investment</Button>} /> : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Current value" value={money(s.value)} />
            <Stat label="Invested" value={money(s.invested)} />
            <Stat label="Gain / loss" value={money(s.gain)} tone={s.gain >= 0 ? "good" : "bad"} sub={`${s.gain >= 0 ? "+" : ""}${pct(s.gainPct)} overall`} />
            <Stat label="Holdings" value={String(data.items.length)} sub={`${groups.length} asset groups`} />
          </div>
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <Section title="Allocation">
              <div className="flex items-center gap-5">
                <Donut size={140} slices={groups} />
                <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                  {groups.map((g) => <li key={g.name} className="flex items-center gap-2"><Swatch color={g.color} /><span className="flex-1 truncate">{g.name}</span><span className="tabular-nums text-ink-muted">{pct((g.value / Math.max(1, s.value)) * 100, 0)}</span></li>)}
                </ul>
              </div>
            </Section>
            <Section title="Maturing in the next 90 days" className="lg:col-span-2">
              {!upcoming.length ? <p className="text-sm text-ink-muted">No FDs or RDs maturing soon.</p> : (
                <ul className="divide-y divide-outline text-sm">
                  {upcoming.map((h) => <li key={h.id} className="flex items-center gap-3 py-2"><span className="flex-1">{h.name}<span className="ml-2 text-xs text-ink-muted">{assetMeta(h.assetClass).label}</span></span><span className="text-ink-muted">{dateLabel(h.maturityDate!)} · {h.daysToMaturity === 0 ? "today" : `${h.daysToMaturity}d`}</span><span className="w-28 text-right tabular-nums">{money(h.maturityValue)}</span></li>)}
                </ul>
              )}
            </Section>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {["all", ...groups.map((g) => g.name)].map((g) => (
              <button key={g} onClick={() => setGroup(g)} className={`rounded-full border px-3 py-1 text-sm ${group === g ? "border-outline bg-stone font-medium" : "border-transparent text-ink-muted hover:bg-paper-grid"}`}>{g === "all" ? "All" : g}</button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border border-outline bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-outline bg-paper-grid text-xs text-ink-muted"><tr>
                <th className="px-4 py-2 text-left font-medium">Investment</th><th className="px-3 py-2 text-right font-medium">Qty / terms</th><th className="px-3 py-2 text-right font-medium">Invested</th><th className="px-3 py-2 text-right font-medium">Value</th><th className="px-3 py-2 text-right font-medium">Gain</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody className="divide-y divide-outline">
                {items.map((h) => { const m = assetMeta(h.assetClass); return (
                  <tr key={h.id} className="hover:bg-paper-grid/50">
                    <td className="px-4 py-2.5"><div className="font-medium">{h.name}{h.retirement ? <span className="ml-2 rounded-sm bg-paper-grid px-1 text-xs font-normal text-ink-muted">retirement</span> : null}</div><div className="text-xs text-ink-muted">{m.label}{h.symbol ? ` · ${h.symbol}` : ""}{h.institution ? ` · ${h.institution}` : ""}</div></td>
                    <td className="px-3 py-2.5 text-right text-xs text-ink-muted">
                      {m.kind === "priced" ? <>{h.quantity} {h.unit ?? ""}<div>avg {precise(h.avgCost)} · now {precise(h.currentPrice ?? h.avgCost)}</div></> : null}
                      {m.kind === "fd" || m.kind === "rd" ? <>{h.interestRate}% p.a.{h.maturityDate ? <div>matures {dateLabel(h.maturityDate)}{h.maturityValue ? ` → ${money(h.maturityValue)}` : ""}</div> : null}{h.progress !== null ? <Progress className="mt-1 ml-auto w-24" pct={h.progress * 100} /> : null}</> : null}
                      {m.kind === "manual" ? "manual value" : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(h.invested)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{money(h.value)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${amountCls(h.gain)}`}>{h.gain >= 0 ? "+" : ""}{money(h.gain)}<div className="text-xs">{pct(h.gainPct)}</div></td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{m.kind === "priced" ? <Button variant="ghost" size="sm" onClick={() => setTrading(h)}>Trade</Button> : null}<Button variant="ghost" size="sm" onClick={() => setEditing(h)}>Edit</Button></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {creating ? <HoldingDialog open onOpenChange={setCreating} /> : null}
      {editing ? <HoldingDialog open onOpenChange={(o) => !o && setEditing(null)} holding={editing} key={editing.id} /> : null}
      {trading ? <TradeDialog holding={trading} onClose={() => setTrading(null)} key={trading.id} /> : null}
      {pricing ? <PricesDialog holdings={priced} onClose={() => setPricing(false)} /> : null}
    </Page>
  );
}
