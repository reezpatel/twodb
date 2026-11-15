import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation, useGoalContributions, useGoals } from "../../lib/queries";
import { del, post } from "../../lib/api";
import { dateLabel, pct, titleCase } from "../../lib/format";
import { AmountDialog } from "../../components/AmountDialog";
import { EmptyState, Page, PageHeader, Progress, Section, Spinner, Stat } from "../../components/Ui";
import { GoalDialog } from "./GoalDialog";
import type { Goal } from "../../lib/types";

function Contributions({ id }: { id: string }) {
  const { money } = useSpace();
  const { data } = useGoalContributions(id);
  const remove = useApiMutation((cid: string) => del(`/goal-contributions/${cid}`));
  if (!data) return null;
  return (
    <ul className="mt-3 divide-y divide-outline border-t border-outline text-xs">
      {data.slice(0, 12).map((c) => <li key={c.id} className="flex items-center gap-2 py-1.5"><span className="w-16 text-ink-muted">{dateLabel(c.date)}</span><span className="flex-1 truncate">{c.note || "Contribution"}</span><span className={`tabular-nums ${c.amount < 0 ? "text-destructive" : "text-success"}`}>{c.amount > 0 ? "+" : ""}{money(c.amount)}</span><button className="text-ink-muted hover:text-destructive" onClick={() => remove.mutate(c.id)} aria-label="Remove">×</button></li>)}
      {!data.length ? <li className="py-2 text-ink-muted">No contributions yet.</li> : null}
    </ul>
  );
}

export function GoalsPage() {
  const { spaceId, money } = useSpace();
  const { data: goals, isLoading } = useGoals(spaceId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const contribute = useApiMutation((v: { id: string; amount: number; note: string }) => post(`/goals/${v.id}/contributions`, { amount: v.amount, note: v.note || undefined }));
  if (isLoading || !goals) return <Spinner />;
  const saved = goals.reduce((s, g) => s + g.saved, 0), target = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <Page>
      <PageHeader title="Goals" subtitle="Savings goals with target dates — emergency fund, big purchases, retirement top-ups" actions={<Button size="sm" onClick={() => setCreating(true)}><Plus />New goal</Button>} />
      {goals.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Saved across goals" value={money(saved)} tone="good" />
          <Stat label="Total targets" value={money(target)} />
          <Stat label="Overall progress" value={pct(target > 0 ? (saved / target) * 100 : 0, 0)} />
        </div>
      ) : null}
      {!goals.length ? <EmptyState title="No goals yet" hint="Set a target and (optionally) a date — Fincal works out the monthly saving you need." action={<Button onClick={() => setCreating(true)}>Create a goal</Button>} /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <Section key={g.id}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: g.color }} /><span className="font-medium">{g.name}</span></div><div className="text-xs text-ink-muted">{titleCase(g.kind)}{g.targetDate ? ` · by ${dateLabel(g.targetDate)}` : ""}</div></div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>Edit</Button>
              </div>
              <div className="mt-2 flex items-baseline justify-between"><span className="text-2xl font-semibold tabular-nums">{money(g.saved)}</span><span className="text-sm text-ink-muted">of {money(g.targetAmount)}</span></div>
              <Progress className="mt-2" pct={g.pct} color={g.color} />
              <div className="mt-1 flex justify-between text-xs text-ink-muted"><span>{pct(g.pct, 0)}</span>{g.requiredMonthly !== null && g.saved < g.targetAmount ? <span>{g.monthsLeft ? `${money(g.requiredMonthly)}/mo for ${g.monthsLeft} months` : `${money(g.requiredMonthly)} still needed`}</span> : g.saved >= g.targetAmount ? <span className="text-success">Goal reached 🎉</span> : null}</div>
              <div className="mt-3 flex gap-1"><Button size="sm" variant="ghost" onClick={() => setAdding(g)}>Add money</Button><Button size="sm" variant="ghost" onClick={() => setOpen(open === g.id ? null : g.id)}>History</Button></div>
              {open === g.id ? <Contributions id={g.id} /> : null}
            </Section>
          ))}
        </div>
      )}
      {creating ? <GoalDialog open onOpenChange={setCreating} /> : null}
      {editing ? <GoalDialog open onOpenChange={(o) => !o && setEditing(null)} goal={editing} key={editing.id} /> : null}
      {adding ? <AmountDialog open onOpenChange={(o) => !o && setAdding(null)} title={`Add to “${adding.name}”`} description="Use a negative amount to withdraw." allowNegative submitLabel="Add" onSubmit={(amount, note) => contribute.mutateAsync({ id: adding.id, amount, note })} /> : null}
    </Page>
  );
}
