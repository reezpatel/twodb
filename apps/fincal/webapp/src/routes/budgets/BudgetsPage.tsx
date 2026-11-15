import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation, useBudgets, useCategories } from "../../lib/queries";
import { del, put } from "../../lib/api";
import { addMonths, monthLong, pct, thisMonth } from "../../lib/format";
import { EmptyState, Page, PageHeader, Progress, Section, selectCls, Spinner, Stat, Swatch } from "../../components/Ui";

export function BudgetsPage() {
  const { spaceId, money } = useSpace();
  const [month, setMonth] = useState(thisMonth());
  const { data, isLoading } = useBudgets(spaceId, month);
  const { data: cats = [] } = useCategories(spaceId);
  const [catId, setCatId] = useState("");
  const [amount, setAmount] = useState("");
  const [edit, setEdit] = useState<{ id: string; categoryId: string; value: string } | null>(null);
  const setBudget = useApiMutation((v: { categoryId: string; amount: number }) => put("/budgets", { spaceId, ...v }), () => { setCatId(""); setAmount(""); setEdit(null); });
  const remove = useApiMutation((id: string) => del(`/budgets/${id}`));
  if (isLoading || !data) return <Spinner />;
  const available = cats.filter((c) => c.kind === "expense" && !data.items.some((i) => i.categoryId === c.id));
  const t = data.totals;

  return (
    <Page>
      <PageHeader title="Budgets" subtitle={`Monthly category budgets · ${monthLong(month)}`}
        actions={<div className="flex items-center rounded-md border border-outline"><Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button><button className="px-2 text-sm" onClick={() => setMonth(thisMonth())}>{monthLong(month)}</button><Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button></div>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Budgeted" value={money(t.budget)} />
        <Stat label="Spent (budgeted)" value={money(t.spent)} sub={t.budget > 0 ? `${pct((t.spent / t.budget) * 100, 0)} of budget` : undefined} />
        <Stat label={t.remaining >= 0 ? "Remaining" : "Over budget"} value={money(Math.abs(t.remaining))} tone={t.remaining >= 0 ? "good" : "bad"} />
      </div>

      <Section title="Category budgets" className="mb-4">
        {!data.items.length ? <EmptyState title="No budgets set" hint="Pick a category and a monthly amount below." /> : (
          <ul className="divide-y divide-outline">
            {data.items.map((b) => (
              <li key={b.id} className="py-3">
                <div className="flex items-center gap-3 text-sm">
                  <Swatch color={b.color} /><span className="flex-1 font-medium">{b.categoryName}</span>
                  {edit?.id === b.id ? (
                    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); setBudget.mutate({ categoryId: b.categoryId, amount: Number(edit.value) }); }}>
                      <Input autoFocus className="h-8 w-28" type="number" min="0" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /><Button size="sm" type="submit">Save</Button>
                    </form>
                  ) : (
                    <button className="tabular-nums hover:underline" onClick={() => setEdit({ id: b.id, categoryId: b.categoryId, value: String(b.amount) })}>{money(b.spent)} <span className="text-ink-muted">/ {money(b.amount)}</span></button>
                  )}
                  <Button variant="ghost" size="sm" aria-label="Remove budget" onClick={() => remove.mutate(b.id)}><Trash2 /></Button>
                </div>
                <Progress className="mt-2" pct={b.pct} over={b.pct > 100} color={b.pct > 80 ? "#f59e0b" : b.color} />
                <div className={`mt-1 text-xs ${b.remaining < 0 ? "text-destructive" : "text-ink-muted"}`}>{b.remaining >= 0 ? `${money(b.remaining)} left` : `${money(-b.remaining)} over`} · {pct(b.pct, 0)}</div>
              </li>
            ))}
          </ul>
        )}
        {available.length ? (
          <form className="mt-4 flex flex-wrap gap-2 border-t border-outline pt-4" onSubmit={(e) => { e.preventDefault(); if (catId && Number(amount) >= 0) setBudget.mutate({ categoryId: catId, amount: Number(amount) }); }}>
            <select className={`${selectCls} !w-56`} value={catId} onChange={(e) => setCatId(e.target.value)}><option value="">Add category…</option>{available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <Input className="w-36" type="number" min="0" placeholder="Monthly amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button type="submit" disabled={!catId || !amount}><Plus />Add</Button>
          </form>
        ) : null}
      </Section>

      {data.unbudgeted.length ? (
        <Section title={`Unbudgeted spending · ${money(t.unbudgetedSpent)}`}>
          <ul className="space-y-1.5 text-sm">
            {data.unbudgeted.map((u) => (
              <li key={u.categoryName} className="flex items-center gap-2"><Swatch color={u.color} /><span className="flex-1">{u.categoryName}</span><span className="tabular-nums">{money(u.spent)}</span>
                {u.categoryId ? <Button variant="ghost" size="sm" onClick={() => setBudget.mutate({ categoryId: u.categoryId!, amount: Math.ceil(u.spent / 100) * 100 })}>Budget this</Button> : null}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Page>
  );
}
