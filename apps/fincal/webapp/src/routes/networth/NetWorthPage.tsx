import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation, useLiabilities, useNetWorth, useSettings } from "../../lib/queries";
import { del, patch, post, put } from "../../lib/api";
import { LIABILITY_KINDS, GROUP_COLORS } from "../../lib/meta";
import { dateLabel, monthLabel, pct, titleCase } from "../../lib/format";
import { errMsg, Field, Page, PageHeader, Progress, Section, selectCls, Spinner, Stat, Swatch } from "../../components/Ui";
import { Donut, LineChart } from "../../components/Charts";
import type { Liability } from "../../lib/types";

function LiabilityDialog({ liability, onClose }: { liability?: Liability; onClose: () => void }) {
  const { spaceId } = useSpace();
  const [name, setName] = useState(liability?.name ?? "");
  const [kind, setKind] = useState(liability?.kind ?? "home_loan");
  const [principal, setPrincipal] = useState(liability?.principal?.toString() ?? "");
  const [outstanding, setOutstanding] = useState(liability?.outstanding?.toString() ?? "");
  const [rate, setRate] = useState(liability?.interestRate?.toString() ?? "");
  const [emi, setEmi] = useState(liability?.emi?.toString() ?? "");
  const [end, setEnd] = useState(liability?.endDate ?? "");
  const [error, setError] = useState("");
  const body = () => ({ name: name.trim(), kind, principal: Number(principal) || 0, outstanding: Number(outstanding) || 0, interestRate: rate ? Number(rate) : null, emi: emi ? Number(emi) : null, endDate: end || null });
  const save = useApiMutation(() => (liability ? patch(`/liabilities/${liability.id}`, body()) : post("/liabilities", { spaceId, ...body() })), onClose);
  const remove = useApiMutation(() => del(`/liabilities/${liability!.id}`), onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{liability ? "Edit loan" : "New loan / liability"}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); setError(""); save.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
          <div className="flex gap-3">
            <Field label="Name" className="flex-1"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Home loan — SBI" /></Field>
            <Field label="Type" className="w-44"><select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value)}>{LIABILITY_KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</select></Field>
          </div>
          <div className="flex gap-3">
            <Field label="Original amount" className="flex-1"><Input type="number" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></Field>
            <Field label="Outstanding now" className="flex-1"><Input type="number" min="0" value={outstanding} onChange={(e) => setOutstanding(e.target.value)} /></Field>
          </div>
          <div className="flex gap-3">
            <Field label="Rate % p.a." className="w-28"><Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
            <Field label="EMI" className="flex-1"><Input type="number" min="0" value={emi} onChange={(e) => setEmi(e.target.value)} /></Field>
            <Field label="Ends" className="flex-1"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {liability ? <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => { if (confirm("Delete this loan?")) remove.mutate(); }}>Delete</Button> : null}
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>{liability ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NetWorthPage() {
  const { spaceId, money, compact } = useSpace();
  const { data: nw, isLoading } = useNetWorth(spaceId);
  const { data: loans = [] } = useLiabilities(spaceId);
  const { data: settings } = useSettings(spaceId);
  const [loan, setLoan] = useState<Liability | "new" | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const saveTarget = useApiMutation((v: number | null) => put("/settings", { spaceId, networthTarget: v }), () => setTarget(null));
  const snap = useApiMutation(() => post("/networth/snapshot", { spaceId }));
  if (isLoading || !nw) return <Spinner />;

  const hist = nw.history;
  const showSnapshots = hist.length >= 2;
  const slices = nw.byGroup.map((g) => ({ ...g, color: GROUP_COLORS[g.name] ?? "#9ca3af" }));

  return (
    <Page wide>
      <PageHeader title="Net worth" subtitle="Everything you own minus everything you owe" actions={<Button variant="ghost" size="sm" onClick={() => snap.mutate()}>Save snapshot</Button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net worth" value={money(nw.netWorth)} tone={nw.netWorth >= 0 ? "good" : "bad"} />
        <Stat label="Assets" value={money(nw.assets)} sub={`${compact(nw.cash)} cash · ${compact(nw.investments)} investments`} />
        <Stat label="Liabilities" value={money(nw.liabilities)} sub={`${compact(nw.cardDues)} cards · ${compact(nw.loans)} loans`} />
        <Stat label="Debt ratio" value={pct(nw.assets > 0 ? (nw.liabilities / nw.assets) * 100 : 0, 0)} sub="liabilities ÷ assets" />
      </div>

      <Section title="Progress to target" className="mb-4" actions={target === null ? <Button variant="ghost" size="sm" onClick={() => setTarget(String(settings?.networthTarget ?? ""))}>{nw.target ? "Change" : "Set a target"}</Button> : null}>
        {target !== null ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveTarget.mutate(target === "" ? null : Number(target)); }}>
            <Input autoFocus type="number" min="0" className="w-52" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Net-worth target" /><Button type="submit">Save</Button><Button type="button" variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
          </form>
        ) : nw.target ? (
          <><div className="mb-2 flex justify-between text-sm"><span>{money(nw.netWorth)} of {money(nw.target)}</span><span className="text-ink-muted">{pct(nw.progressPct, 0)}</span></div><Progress pct={nw.progressPct ?? 0} /><div className="mt-1 text-xs text-ink-muted">{nw.netWorth >= nw.target ? "Target reached 🎉" : `${money(nw.target - nw.netWorth)} to go`}</div></>
        ) : <p className="text-sm text-ink-muted">Set a net-worth target to track your progress.</p>}
      </Section>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Section title={showSnapshots ? "Net worth history" : "Net cash position (last 12 months)"} className="lg:col-span-2">
          {showSnapshots ? (
            <LineChart area fmt={compact} target={nw.target} labels={hist.map((h) => dateLabel(h.date))}
              series={[{ name: "Net worth", color: "#6366f1", values: hist.map((h) => h.netWorth) }, { name: "Assets", color: "#22c55e", values: hist.map((h) => h.assets) }, { name: "Liabilities", color: "#ef4444", values: hist.map((h) => h.liabilities) }]} />
          ) : nw.cashHistory.length >= 2 ? (
            <>
              <LineChart area fmt={compact} labels={nw.cashHistory.map((c) => monthLabel(c.month))} series={[{ name: "Bank + cash − card dues", color: "#6366f1", values: nw.cashHistory.map((c) => c.balance) }]} />
              <p className="mt-2 text-xs text-ink-muted">Rebuilt from your transactions. A full net-worth line (with investments) builds up as Fincal saves a daily snapshot each time you open the app.</p>
            </>
          ) : <p className="text-sm text-ink-muted">History appears after a couple of days of use — Fincal saves a snapshot daily.</p>}
        </Section>
        <Section title="Asset mix">
          {!slices.length ? <p className="text-sm text-ink-muted">No assets yet.</p> : (
            <div className="flex flex-col items-center gap-4">
              <Donut slices={slices} size={150} center={<><div className="text-xs text-ink-muted">Assets</div><div className="text-sm font-semibold">{compact(nw.assets)}</div></>} />
              <ul className="w-full space-y-1.5 text-sm">{slices.map((g) => <li key={g.name} className="flex items-center gap-2"><Swatch color={g.color} /><span className="flex-1">{g.name}</span><span className="tabular-nums">{money(g.value)}</span></li>)}</ul>
            </div>
          )}
        </Section>
      </div>

      <Section title="Loans & liabilities" actions={<Button variant="ghost" size="sm" onClick={() => setLoan("new")}><Plus />Add loan</Button>}>
        {nw.cardDues > 0 ? <p className="mb-2 text-sm text-ink-muted">Credit-card dues of {money(nw.cardDues)} are included automatically.</p> : null}
        {!loans.length ? <p className="text-sm text-ink-muted">No loans recorded.</p> : (
          <ul className="divide-y divide-outline text-sm">
            {loans.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><div className="font-medium">{l.name}</div><div className="text-xs text-ink-muted">{titleCase(l.kind)}{l.interestRate ? ` · ${l.interestRate}%` : ""}{l.emi ? ` · EMI ${money(l.emi)}` : ""}{l.endDate ? ` · ends ${dateLabel(l.endDate)}` : ""}</div>
                  {l.principal > 0 ? <Progress className="mt-1.5 max-w-xs" pct={((l.principal - l.outstanding) / l.principal) * 100} color="#22c55e" /> : null}</div>
                <div className="text-right"><div className="font-semibold tabular-nums">{money(l.outstanding)}</div>{l.principal > 0 ? <div className="text-xs text-ink-muted">{pct(((l.principal - l.outstanding) / l.principal) * 100, 0)} repaid</div> : null}</div>
                <Button variant="ghost" size="sm" onClick={() => setLoan(l)}>Edit</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {loan ? <LiabilityDialog liability={loan === "new" ? undefined : loan} onClose={() => setLoan(null)} key={loan === "new" ? "new" : loan.id} /> : null}
    </Page>
  );
}
