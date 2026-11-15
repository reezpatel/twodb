import { useMemo, useState } from "react";
import { useSpace } from "../../lib/space";
import { useAnalytics } from "../../lib/queries";
import { addMonths, dateLabel, monthLabel, pct, thisMonth, titleCase, todayIso, WEEKDAYS } from "../../lib/format";
import { EmptyState, Page, PageHeader, Section, Segmented, Spinner, Stat, Swatch } from "../../components/Ui";
import { BarChart, Donut, LineChart } from "../../components/Charts";

const PRESETS = [{ id: "6", label: "6 months" }, { id: "12", label: "12 months" }, { id: "24", label: "24 months" }, { id: "ytd", label: "This year" }] as const;

function HBars({ rows, fmt }: { rows: { name: string; value: number; color?: string; sub?: string }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between gap-2"><span className="truncate">{r.name}{r.sub ? <span className="ml-1 text-xs text-ink-muted">{r.sub}</span> : null}</span><span className="tabular-nums">{fmt(r.value)}</span></div>
          <div className="mt-0.5 h-1.5 rounded-full bg-paper-grid"><div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? "#6366f1" }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsPage() {
  const { spaceId, money, compact } = useSpace();
  const [preset, setPreset] = useState<string>("12");
  const range = useMemo(() => {
    const to = todayIso();
    const from = preset === "ytd" ? `${to.slice(0, 4)}-01-01` : `${addMonths(thisMonth(), -(Number(preset) - 1))}-01`;
    return { from, to };
  }, [preset]);
  const { data: a, isLoading } = useAnalytics(spaceId, range.from, range.to);
  if (isLoading || !a) return <Spinner />;
  const empty = a.stats.totalIncome === 0 && a.stats.totalExpense === 0;
  const labels = a.monthly.map((m) => monthLabel(m.month, a.monthly.length > 12));
  const cur = thisMonth();
  const completed = a.monthly.filter((m) => m.month < cur);
  const fcLabels = [...completed.map((m) => monthLabel(m.month, true)), ...a.forecast.map((f) => monthLabel(f.month, true))];
  const fcActual = [...completed.map((m) => m.expense), ...a.forecast.map(() => null)];
  const fcExpense = [...completed.map((m, i) => (i === completed.length - 1 ? m.expense : null)), ...a.forecast.map((f) => f.expense)];
  const fcIncomeAct = [...completed.map((m) => m.income), ...a.forecast.map(() => null)];
  const fcIncome = [...completed.map((m, i) => (i === completed.length - 1 ? m.income : null)), ...a.forecast.map((f) => f.income)];
  const wkMax = Math.max(1, ...a.byWeekday.map((d) => d.amount));

  return (
    <Page wide>
      <PageHeader title="Analytics" subtitle={`${dateLabel(a.from)} – ${dateLabel(a.to)}`} actions={<Segmented value={preset as any} onChange={setPreset} options={PRESETS.map((p) => ({ id: p.id, label: p.label })) as any} />} />
      {empty ? <EmptyState title="Nothing to analyse yet" hint="Record some income and expenses to see trends, category breakdowns and forecasts." /> : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Income" value={compact(a.stats.totalIncome)} sub={`${compact(a.stats.avgMonthlyIncome)}/mo avg`} tone="good" />
            <Stat label="Spent" value={compact(a.stats.totalExpense)} sub={`${compact(a.stats.avgMonthlyExpense)}/mo avg`} />
            <Stat label="Saved" value={compact(a.stats.net)} tone={a.stats.net >= 0 ? "good" : "bad"} />
            <Stat label="Savings rate" value={pct(a.stats.savingsRate, 0)} tone={(a.stats.savingsRate ?? 0) >= 20 ? "good" : undefined} />
            <Stat label="Daily spend" value={money(a.stats.avgDailyExpense)} />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Section title="Income vs spending"><BarChart fmt={compact} labels={labels} series={[{ name: "Income", color: "#22c55e", values: a.monthly.map((m) => m.income) }, { name: "Spent", color: "#f97316", values: a.monthly.map((m) => m.expense) }]} /></Section>
            <Section title="Savings rate by month"><LineChart fmt={(n) => `${Math.round(n)}%`} labels={labels} series={[{ name: "Savings rate", color: "#6366f1", values: a.monthly.map((m) => m.savingsRate) }]} /></Section>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Section title="Spending by category" className="lg:col-span-2">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <Donut slices={a.expenseByCategory.slice(0, 10).map((c) => ({ name: c.name, value: c.amount, color: c.color }))} center={<><div className="text-xs text-ink-muted">Total</div><div className="text-sm font-semibold">{compact(a.stats.totalExpense)}</div></>} />
                <ul className="w-full flex-1 space-y-1.5 text-sm">
                  {a.expenseByCategory.slice(0, 10).map((c) => <li key={c.name} className="flex items-center gap-2"><Swatch color={c.color} /><span className="flex-1 truncate">{c.name}</span><span className="text-xs text-ink-muted">{c.count} txns</span><span className="w-12 text-right tabular-nums text-ink-muted">{pct(c.pct, 0)}</span><span className="w-24 text-right tabular-nums">{money(c.amount)}</span></li>)}
                </ul>
              </div>
            </Section>
            <Section title="Income sources">
              <HBars fmt={money} rows={a.incomeByCategory.slice(0, 8).map((c) => ({ name: c.name, value: c.amount, color: c.color }))} />
              {!a.incomeByCategory.length ? <p className="text-sm text-ink-muted">No income recorded.</p> : null}
            </Section>
          </div>

          {a.categoryTrend.length && a.monthly.length > 1 ? (
            <Section title="Top categories over time" className="mb-4">
              <LineChart fmt={compact} labels={labels} series={a.categoryTrend.map((c) => ({ name: c.name, color: c.color, values: c.values }))} />
            </Section>
          ) : null}

          <Section title="Forecast" className="mb-4">
            {a.forecast.length ? (
              <>
                <LineChart fmt={compact} labels={fcLabels} series={[
                  { name: "Spending", color: "#f97316", values: fcActual }, { name: "Spending (forecast)", color: "#f97316", values: fcExpense, dashedFrom: 0 },
                  { name: "Income", color: "#22c55e", values: fcIncomeAct }, { name: "Income (forecast)", color: "#22c55e", values: fcIncome, dashedFrom: 0 },
                ]} />
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                  {a.forecast.map((f) => <div key={f.month} className="rounded-md border border-outline p-3"><div className="text-xs text-ink-muted">{monthLabel(f.month, true)}</div><div>Spend ≈ <b>{money(f.expense)}</b></div><div className={f.net >= 0 ? "text-success" : "text-destructive"}>{f.net >= 0 ? "Save" : "Deficit"} ≈ {money(Math.abs(f.net))}</div></div>)}
                </div>
                <p className="mt-2 text-xs text-ink-muted">Straight-line trend over your last {Math.min(6, completed.length)} completed months. A guide, not a promise.</p>
              </>
            ) : <p className="text-sm text-ink-muted">Needs at least two completed months of data to project a trend.</p>}
          </Section>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Section title="By payment method"><HBars fmt={money} rows={a.byMethod.map((m) => ({ name: titleCase(m.method), value: m.amount }))} />{!a.byMethod.length ? <p className="text-sm text-ink-muted">No expenses.</p> : null}</Section>
            <Section title="By account"><HBars fmt={money} rows={a.byAccount.map((m) => ({ name: m.name, value: m.amount, color: m.color, sub: titleCase(m.type) }))} /></Section>
            <Section title="Top payees"><HBars fmt={money} rows={a.topPayees.map((m) => ({ name: m.payee, value: m.amount, sub: `${m.count}×`, color: "#8b5cf6" }))} />{!a.topPayees.length ? <p className="text-sm text-ink-muted">Add payees to expenses to see them here.</p> : null}</Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Spending by weekday">
              <div className="flex h-32 items-end gap-2">
                {a.byWeekday.map((d) => <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${WEEKDAYS[d.day]}: ${money(d.amount)} (${d.count} txns)`}><div className="w-full rounded-t-sm bg-ion-deep/70" style={{ height: `${(d.amount / wkMax) * 100}%`, minHeight: 2 }} /><span className="text-xs text-ink-muted">{WEEKDAYS[d.day]}</span></div>)}
              </div>
            </Section>
            <Section title="Recurring payments">
              {!a.recurring.length ? <p className="text-sm text-ink-muted">Payees you pay at a steady amount in 3+ months show up here.</p> : (
                <ul className="space-y-1.5 text-sm">{a.recurring.map((r) => <li key={r.payee} className="flex gap-2"><span className="flex-1 truncate">{r.payee}</span><span className="text-xs text-ink-muted">{r.months} mo</span><span className="tabular-nums">{money(r.avgAmount)}</span></li>)}
                  <li className="border-t border-outline pt-1.5 text-xs text-ink-muted">≈ {money(a.recurring.reduce((s, r) => s + r.avgAmount, 0))} per month committed</li></ul>
              )}
            </Section>
            <Section title="Biggest expenses">
              <ul className="space-y-1.5 text-sm">{a.biggest.map((b, i) => <li key={i} className="flex gap-2"><span className="w-14 text-xs text-ink-muted">{dateLabel(b.date)}</span><span className="flex-1 truncate">{b.payee || b.category || "Expense"}</span><span className="tabular-nums">{money(b.amount)}</span></li>)}</ul>
            </Section>
          </div>
        </>
      )}
    </Page>
  );
}
