import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Hourglass } from "lucide-react";
import { Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { CALCULATORS, type Calculator, type Stat as CalcStat } from "../../lib/calc";
import { pct } from "../../lib/format";
import { Field, Page, PageHeader, Section } from "../../components/Ui";
import { LineChart } from "../../components/Charts";

function show(s: CalcStat, money: (n: number) => string) {
  if (typeof s.value === "string") return s.value;
  return s.kind === "money" ? money(s.value) : s.kind === "pct" ? pct(s.value, 2) : String(s.value);
}

function CalcView({ calc }: { calc: Calculator }) {
  const { money, compact } = useSpace();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(calc.fields.map((f) => [f.key, String(f.value)])));
  const numeric = useMemo(() => Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)])), [vals]);
  const valid = Object.values(numeric).every((n) => Number.isFinite(n) && n >= 0);
  const result = useMemo(() => { try { return valid ? calc.run(numeric) : null; } catch { return null; } }, [calc, numeric, valid]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Section className="lg:col-span-2">
        <h2 className="text-base font-semibold">{calc.title}</h2><p className="mb-4 text-sm text-ink-muted">{calc.blurb}</p>
        <div className="flex flex-col gap-3">
          {calc.fields.map((f) => (
            <Field key={f.key} label={f.label + (f.suffix ? ` (${f.suffix})` : "")}>
              <Input type="number" min={f.min ?? 0} step={f.step ?? 1} value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Section>
      <div className="flex flex-col gap-4 lg:col-span-3">
        {!result ? <Section><p className="text-sm text-ink-muted">Enter valid, non-negative numbers.</p></Section> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.stats.map((s) => (
                <div key={s.label} className="rounded-md border border-outline bg-card p-4">
                  <div className="text-xs font-medium tracking-wide text-ink-muted uppercase">{s.label}</div>
                  <div className={`mt-1 text-xl font-semibold tabular-nums ${s.tone === "good" ? "text-success" : s.tone === "bad" ? "text-destructive" : ""}`}>{show(s, money)}</div>
                </div>
              ))}
            </div>
            {result.note ? <p className="text-sm text-ink-muted">{result.note}</p> : null}
            {result.chart ? <Section title={result.chart.title}><LineChart area fmt={compact} labels={result.chart.labels} series={result.chart.series} /></Section> : null}
          </>
        )}
      </div>
    </div>
  );
}

export function CalculatorsPage() {
  const { calcId = CALCULATORS[0].id, } = useParams();
  const { spaceId } = useSpace();
  const nav = useNavigate();
  const calc = CALCULATORS.find((c) => c.id === calcId) ?? CALCULATORS[0];
  return (
    <Page wide>
      <PageHeader title="Calculators" subtitle="Quick what-ifs — nothing here is saved or touches your data" />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {CALCULATORS.map((c) => <button key={c.id} onClick={() => nav(`/s/${spaceId}/calculators/${c.id}`)} className={`rounded-full border px-3 py-1 text-sm ${c.id === calc.id ? "border-outline bg-stone font-medium" : "border-transparent text-ink-muted hover:bg-paper-grid"}`}>{c.title}</button>)}
        <Link to={`/s/${spaceId}/retirement`} className="inline-flex items-center gap-1 rounded-full border border-transparent px-3 py-1 text-sm text-ink-muted hover:bg-paper-grid"><Hourglass className="size-3.5" />Retirement planner →</Link>
      </div>
      <CalcView calc={calc} key={calc.id} />
    </Page>
  );
}
