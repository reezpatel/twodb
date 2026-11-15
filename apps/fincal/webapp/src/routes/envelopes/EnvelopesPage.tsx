import { useState } from "react";
import { ArrowRightLeft, History, Plus, Wallet } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation, useEnvelopeHistory, useEnvelopes } from "../../lib/queries";
import { del, post } from "../../lib/api";
import { dateLabel, pct } from "../../lib/format";
import { AmountDialog } from "../../components/AmountDialog";
import { EmptyState, Page, PageHeader, Progress, Section, selectCls, Spinner, Stat } from "../../components/Ui";
import { EnvelopeDialog } from "./EnvelopeDialog";
import type { Envelope } from "../../lib/types";

type Action = { kind: "fund" | "release" | "move"; env: Envelope } | null;

function History_({ id }: { id: string }) {
  const { money } = useSpace();
  const { data } = useEnvelopeHistory(id);
  const remove = useApiMutation((aid: string) => del(`/envelope-allocations/${aid}`));
  if (!data) return <div className="py-2 text-xs text-ink-muted">Loading…</div>;
  const rows = [
    ...data.allocations.map((a) => ({ key: a.id, date: a.date, label: a.note || (a.amount > 0 ? "Funded" : "Released"), amount: a.amount, alloc: true })),
    ...data.expenses.map((t) => ({ key: t.id, date: t.date, label: t.payee || "Expense", amount: -t.amount, alloc: false })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15);
  return (
    <ul className="mt-3 divide-y divide-outline border-t border-outline text-xs">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 py-1.5"><span className="w-16 text-ink-muted">{dateLabel(r.date)}</span><span className="flex-1 truncate">{r.label}</span><span className={`tabular-nums ${r.amount < 0 ? "" : "text-success"}`}>{r.amount > 0 ? "+" : ""}{money(r.amount)}</span>
          {r.alloc ? <button className="text-ink-muted hover:text-destructive" onClick={() => remove.mutate(r.key)} aria-label="Remove">×</button> : <span className="w-2" />}</li>
      ))}
      {!rows.length ? <li className="py-2 text-ink-muted">No activity yet.</li> : null}
    </ul>
  );
}

export function EnvelopesPage() {
  const { spaceId, money } = useSpace();
  const { data, isLoading } = useEnvelopes(spaceId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Envelope | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [open, setOpen] = useState<string | null>(null);
  const fill = useApiMutation(() => post<{ filled: number; total: number }>("/envelopes/fill", { spaceId }));
  if (isLoading || !data) return <Spinner />;
  const hasFill = data.items.some((e) => (e.monthlyFill ?? 0) > 0);

  return (
    <Page>
      <PageHeader title="Envelopes" subtitle="Give every rupee a job: set money aside for things you'll need, then tag expenses to spend from an envelope."
        actions={<>{hasFill ? <Button variant="ghost" size="sm" disabled={fill.isPending} onClick={() => { if (confirm("Add every envelope's monthly fill amount now?")) fill.mutate(); }}>Fill monthly</Button> : null}<Button size="sm" onClick={() => setCreating(true)}><Plus />New envelope</Button></>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="In envelopes" value={money(data.totalBalance)} />
        <Stat label="Unallocated" value={money(data.unallocated)} tone={data.unallocated < 0 ? "bad" : "good"} sub={data.unallocated < 0 ? "More set aside than you have in accounts" : "Spendable money not in any envelope"} />
        <Stat label="Envelopes" value={String(data.items.length)} />
      </div>
      {!data.items.length ? <EmptyState title="No envelopes yet" hint="Create envelopes for goals like Holiday, Insurance premium or Emergency fund." action={<Button onClick={() => setCreating(true)}>Create an envelope</Button>} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.items.map((e) => (
            <Section key={e.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: e.color }} /><span className="font-medium">{e.name}</span></div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>Edit</Button>
              </div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${e.balance < 0 ? "text-destructive" : ""}`}>{money(e.balance)}</div>
              <div className="text-xs text-ink-muted">{money(e.funded)} funded · {money(e.spent)} spent{e.monthlyFill ? ` · +${money(e.monthlyFill)}/mo` : ""}</div>
              {e.target ? <><Progress className="mt-3" pct={e.pct ?? 0} color={e.color} /><div className="mt-1 text-xs text-ink-muted">{pct(e.pct, 0)} of {money(e.target)}</div></> : null}
              <div className="mt-3 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "fund", env: e })}><Wallet />Fund</Button>
                <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "release", env: e })}>Release</Button>
                {data.items.length > 1 ? <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "move", env: e })}><ArrowRightLeft />Move</Button> : null}
                <Button size="sm" variant="ghost" onClick={() => setOpen(open === e.id ? null : e.id)}><History />History</Button>
              </div>
              {open === e.id ? <History_ id={e.id} /> : null}
            </Section>
          ))}
        </div>
      )}
      {creating ? <EnvelopeDialog open onOpenChange={setCreating} /> : null}
      {editing ? <EnvelopeDialog open onOpenChange={(o) => !o && setEditing(null)} envelope={editing} key={editing.id} /> : null}
      {action ? (
        <MoveDialog action={action} others={data.items.filter((x) => x.id !== action.env.id)} spaceId={spaceId} onClose={() => setAction(null)} />
      ) : null}
    </Page>
  );
}

function MoveDialog({ action, others, spaceId, onClose }: { action: NonNullable<Action>; others: Envelope[]; spaceId: string; onClose: () => void }) {
  const run = useApiMutation((v: { amount: number; note: string; to: string }) =>
    action.kind === "move" ? post("/envelopes/transfer", { spaceId, fromId: action.env.id, toId: v.to, amount: v.amount, note: v.note || undefined })
      : post(`/envelopes/${action.env.id}/allocate`, { amount: action.kind === "release" ? -v.amount : v.amount, note: v.note || undefined }));
  const titles = { fund: `Fund “${action.env.name}”`, release: `Release from “${action.env.name}”`, move: `Move from “${action.env.name}”` };
  return (
    <AmountDialog open onOpenChange={(o) => !o && onClose()} title={titles[action.kind]} submitLabel={action.kind === "move" ? "Move" : action.kind === "fund" ? "Fund" : "Release"}
      description={action.kind === "release" ? "Returns money to unallocated." : undefined}
      extra={({ setExtra }) => action.kind === "move" ? (
        <select className={selectCls} defaultValue="" onChange={(e) => setExtra(e.target.value)}><option value="" disabled>To envelope…</option>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      ) : null}
      onSubmit={(amount, note, to) => { if (action.kind === "move" && !to) throw new Error("Pick a destination envelope"); return run.mutateAsync({ amount, note, to }); }} />
  );
}
