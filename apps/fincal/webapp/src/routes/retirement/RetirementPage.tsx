import { Button, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { pct } from "../../lib/format";
import { assetMeta } from "../../lib/meta";
import { Field, Page, PageHeader, Progress, Section, Spinner, Stat } from "../../components/Ui";
import { LineChart } from "../../components/Charts";
import { FIELDS, useRetirementPage } from "./useRetirementPage";

export function RetirementPage() {
  const { money, compact } = useSpace();
  const p = useRetirementPage();
  if (p.loading || !p.result) return <Spinner />;
  const { projection: pr, corpus } = p.result;
  const retireAge = Number(p.form.retirementAge);
  const series = pr.series;
  const saving = series.map((x) => (x.age <= retireAge ? x.balance : null));
  const retired = series.map((x) => (x.age >= retireAge ? x.balance : null));
  const gap = pr.projectedCorpus - pr.requiredCorpus;

  return (
    <Page wide>
      <PageHeader title="Retirement" subtitle="Will your savings last? Change any assumption to see the effect instantly."
        actions={<>{p.dirty ? <Button variant="ghost" size="sm" onClick={p.reset}>Reset</Button> : null}<Button size="sm" onClick={() => p.save.mutate()} disabled={!p.dirty || !p.valid || p.save.isPending}>Save plan</Button></>} />
      {!p.valid ? <p className="mb-4 text-sm text-destructive">Retirement age must be above current age, and plan-until age above retirement age.</p> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Corpus needed at retirement" value={compact(pr.requiredCorpus)} sub={`${money(pr.monthlyExpenseAtRetirement)}/mo then (inflated)`} />
        <Stat label="Projected corpus" value={compact(pr.projectedCorpus)} tone={pr.onTrack ? "good" : "bad"} sub={`${pct(pr.coveragePct, 0)} of what you need`} />
        <Stat label={gap >= 0 ? "Surplus" : "Shortfall"} value={compact(Math.abs(gap))} tone={gap >= 0 ? "good" : "bad"} />
        <Stat label="Monthly saving needed" value={money(pr.requiredMonthlySaving)} sub={pr.requiredMonthlySaving > Number(p.form.monthlySaving) ? `${money(pr.requiredMonthlySaving - Number(p.form.monthlySaving))} more than now` : "You're saving enough"} tone={pr.onTrack ? "good" : "bad"} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Section title="Corpus by age" className="lg:col-span-2">
          <LineChart area fmt={compact} labels={series.map((x) => String(x.age))} series={[{ name: "Saving years", color: "#6366f1", values: saving }, { name: "Retirement years", color: pr.depletesAtAge ? "#ef4444" : "#22c55e", values: retired }]} />
          <p className={`mt-2 text-sm ${pr.depletesAtAge ? "text-destructive" : "text-success"}`}>
            {pr.depletesAtAge ? `Money runs out at age ${pr.depletesAtAge}, ${p.form.lifeExpectancy ? Number(p.form.lifeExpectancy) - pr.depletesAtAge : 0} years before the end of your plan.` : `Your corpus lasts beyond age ${p.form.lifeExpectancy}.`}
          </p>
        </Section>
        <Section title="Today's retirement corpus">
          <div className="text-2xl font-semibold tabular-nums">{money(corpus.total)}</div>
          <Progress className="mt-2" pct={pr.requiredCorpus > 0 ? (corpus.total / pr.requiredCorpus) * 100 : 0} />
          <div className="mt-1 mb-3 text-xs text-ink-muted">{pct(pr.requiredCorpus > 0 ? (corpus.total / pr.requiredCorpus) * 100 : 0, 1)} of the target already</div>
          <ul className="space-y-1.5 text-sm">
            {corpus.holdings.map((h) => <li key={h.id} className="flex gap-2"><span className="flex-1 truncate">{h.name}<span className="ml-1 text-xs text-ink-muted">{assetMeta(h.assetClass).label}</span></span><span className="tabular-nums">{money(h.value)}</span></li>)}
            {corpus.other > 0 ? <li className="flex gap-2"><span className="flex-1">Other savings</span><span className="tabular-nums">{money(corpus.other)}</span></li> : null}
            {!corpus.holdings.length && !corpus.other ? <li className="text-ink-muted">Flag investments as “counts toward retirement” (or add PPF / EPF / NPS) to include them.</li> : null}
          </ul>
        </Section>
      </div>

      <Section title="Assumptions">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label + (f.suffix ? ` (${f.suffix})` : "")} hint={f.hint}>
              <Input type="number" step={f.step ?? 1} min="0" value={p.form[f.key] ?? ""} onChange={(e) => p.setField(f.key, e.target.value)} />
            </Field>
          ))}
        </div>
      </Section>
    </Page>
  );
}
