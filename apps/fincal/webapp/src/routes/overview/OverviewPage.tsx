import { useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useOverview } from "../../lib/queries";
import { addMonths, dateLabel, monthLong, pct, thisMonth } from "../../lib/format";
import { accountMeta, GROUP_COLORS } from "../../lib/meta";
import { amountCls, EmptyState, Page, PageHeader, Progress, Section, Spinner, Stat, Swatch } from "../../components/Ui";
import { Donut } from "../../components/Charts";
import { TxnDialog } from "../transactions/TxnDialog";

export function OverviewPage() {
  const { spaceId, spaceName, money, compact } = useSpace();
  const [month, setMonth] = useState(thisMonth());
  const [adding, setAdding] = useState(false);
  const { data: o, isLoading } = useOverview(spaceId, month);
  if (isLoading || !o) return <Spinner />;
  const base = `/s/${spaceId}`;
  const isCurrent = month === thisMonth();
  const spendDelta = o.previous.expense > 0 ? ((o.expense - o.previous.expense) / o.previous.expense) * 100 : null;
  const overBudget = (o.budget.pct ?? 0) > 100;
  const empty = !o.accounts.length;

  return (
    <Page wide>
      <PageHeader
        title={spaceName || "Overview"}
        subtitle={monthLong(month)}
        actions={<>
          <div className="flex items-center rounded-md border border-outline">
            <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft /></Button>
            <button className="px-2 text-sm" onClick={() => setMonth(thisMonth())}>{isCurrent ? "This month" : "Today"}</button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(addMonths(month, 1))} disabled={isCurrent} aria-label="Next month"><ChevronRight /></Button>
          </div>
          <Button size="sm" onClick={() => setAdding(true)} disabled={empty}><Plus />Add transaction</Button>
        </>}
      />
      {empty ? <EmptyState title="Start by adding an account" hint="Add a bank account, cash wallet, UPI or credit card, then record transactions against it." action={<Link to={`${base}/accounts`}><Button>Add account</Button></Link>} /> : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Income" value={money(o.income)} tone="good" />
            <Stat label="Spent" value={money(o.expense)} sub={spendDelta === null ? undefined : `${spendDelta >= 0 ? "▲" : "▼"} ${Math.abs(spendDelta).toFixed(0)}% vs last month`} />
            <Stat label="Saved" value={money(o.net)} tone={o.net >= 0 ? "good" : "bad"} sub={o.savingsRate === null ? undefined : `${pct(o.savingsRate, 0)} savings rate`} />
            <Stat label="Net worth" value={money(o.netWorth.netWorth)} sub={`${compact(o.netWorth.assets)} assets · ${compact(o.netWorth.liabilities)} owed`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              {isCurrent && o.expense > 0 ? (
                <Section title="Month-end projection">
                  <p className="text-sm">At this pace (day {o.dayOfMonth} of {o.daysInMonth}) you'll spend about <b>{money(o.projectedExpense)}</b>{o.budget.amount > 0 ? <> against a <b>{money(o.budget.amount)}</b> budget</> : null}.</p>
                </Section>
              ) : null}
              <Section title="Budget" actions={<Link className="text-xs text-ink-muted hover:text-ink" to={`${base}/budgets`}>Manage</Link>}>
                {o.budget.count === 0 ? <p className="text-sm text-ink-muted">No budgets yet. <Link className="underline" to={`${base}/budgets`}>Set category budgets</Link> to track them here.</p> : (
                  <>
                    <div className="mb-2 flex justify-between text-sm"><span>{money(o.budget.spent)} of {money(o.budget.amount)}</span><span className={overBudget ? "text-destructive" : "text-ink-muted"}>{pct(o.budget.pct, 0)}</span></div>
                    <Progress pct={o.budget.pct ?? 0} over={overBudget} />
                  </>
                )}
              </Section>
              <Section title="Recent transactions" actions={<Link className="text-xs text-ink-muted hover:text-ink" to={`${base}/transactions`}>View all</Link>}>
                {!o.recent.length ? <p className="text-sm text-ink-muted">Nothing recorded yet.</p> : (
                  <ul className="divide-y divide-outline">
                    {o.recent.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                        <Swatch color={t.categoryColor ?? "#9ca3af"} />
                        <div className="min-w-0 flex-1"><div className="truncate">{t.payee || t.categoryName || (t.kind === "transfer" ? "Transfer" : "Transaction")}</div><div className="truncate text-xs text-ink-muted">{dateLabel(t.date)} · {t.accountName}{t.kind === "transfer" ? ` → ${t.toAccountName}` : t.categoryName ? ` · ${t.categoryName}` : ""}</div></div>
                        <span className={`tabular-nums ${t.kind === "income" ? amountCls(1) : t.kind === "expense" ? "" : "text-ink-muted"}`}>{t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""}{money(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <div className="flex flex-col gap-4">
              <Section title="Where it went">
                {!o.topCategories.length ? <p className="text-sm text-ink-muted">No expenses this month.</p> : (
                  <div className="flex flex-col items-center gap-4">
                    <Donut slices={o.topCategories.map((c) => ({ name: c.name, value: c.amount, color: c.color }))} center={<><div className="text-xs text-ink-muted">Spent</div><div className="text-sm font-semibold">{compact(o.expense)}</div></>} />
                    <ul className="w-full space-y-1.5 text-sm">
                      {o.topCategories.map((c) => <li key={c.name} className="flex items-center gap-2"><Swatch color={c.color} /><span className="flex-1 truncate">{c.name}</span><span className="tabular-nums text-ink-muted">{pct(c.pct, 0)}</span><span className="w-20 text-right tabular-nums">{money(c.amount)}</span></li>)}
                    </ul>
                  </div>
                )}
              </Section>
              <Section title="Accounts" actions={<Link className="text-xs text-ink-muted hover:text-ink" to={`${base}/accounts`}>Manage</Link>}>
                <ul className="space-y-1.5 text-sm">
                  {o.accounts.map((a) => { const Icon = accountMeta(a.type).icon; return (
                    <li key={a.id} className="flex items-center gap-2"><Icon className="size-4 text-ink-muted" /><span className="flex-1 truncate">{a.name}</span><span className={`tabular-nums ${a.balance < 0 ? "text-destructive" : ""}`}>{money(a.balance)}</span></li>
                  ); })}
                </ul>
              </Section>
              {o.cards.length ? (
                <Section title="Credit cards">
                  <ul className="space-y-3 text-sm">
                    {o.cards.map((c) => (
                      <li key={c.id}>
                        <div className="flex justify-between"><span>{c.name}</span><span className="tabular-nums">{money(c.due)} due</span></div>
                        {c.limit ? <Progress className="mt-1" pct={c.utilizationPct ?? 0} over={(c.utilizationPct ?? 0) > 70} /> : null}
                        <div className="mt-0.5 text-xs text-ink-muted">{c.utilizationPct !== null ? `${pct(c.utilizationPct, 0)} of limit` : ""}{c.dueDay ? ` · pay by the ${c.dueDay}${ord(c.dueDay)}` : ""}</div>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
              <Section title="Net worth mix" actions={<Link className="text-xs text-ink-muted hover:text-ink" to={`${base}/networth`}>Details</Link>}>
                <ul className="space-y-1.5 text-sm">
                  {o.netWorth.byGroup.map((g) => <li key={g.name} className="flex items-center gap-2"><Swatch color={GROUP_COLORS[g.name] ?? "#9ca3af"} /><span className="flex-1">{g.name}</span><span className="tabular-nums">{money(g.value)}</span></li>)}
                  {!o.netWorth.byGroup.length ? <li className="text-ink-muted">No assets yet.</li> : null}
                </ul>
              </Section>
            </div>
          </div>
        </>
      )}
      {adding ? <TxnDialog open onOpenChange={setAdding} /> : null}
    </Page>
  );
}

const ord = (n: number) => (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
