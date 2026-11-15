import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useSpace } from "../../lib/space";
import { useApiMutation, useRetirement } from "../../lib/queries";
import { post, put } from "../../lib/api";
import type { RetirementPlan, RetirementResp } from "../../lib/types";

export const FIELDS: { key: keyof RetirementPlan; label: string; suffix?: string; step?: number; hint?: string }[] = [
  { key: "currentAge", label: "Current age", suffix: "yrs" },
  { key: "retirementAge", label: "Retirement age", suffix: "yrs" },
  { key: "lifeExpectancy", label: "Plan until age", suffix: "yrs", hint: "Life expectancy to plan for" },
  { key: "monthlyExpense", label: "Monthly expenses (today's money)" },
  { key: "monthlySaving", label: "Monthly saving for retirement" },
  { key: "stepUp", label: "Yearly step-up in saving", suffix: "%", step: 0.5 },
  { key: "otherCorpus", label: "Other retirement savings", hint: "On top of holdings flagged as retirement, PPF, EPF and NPS" },
  { key: "inflation", label: "Inflation", suffix: "%", step: 0.1 },
  { key: "preReturn", label: "Return before retirement", suffix: "% p.a.", step: 0.1 },
  { key: "postReturn", label: "Return after retirement", suffix: "% p.a.", step: 0.1 },
];

/** Holding hook: editable assumptions, debounced what-if projection from the server, save. */
export function useRetirementPage() {
  const { spaceId } = useSpace();
  const saved = useRetirement(spaceId);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [debounced, setDebounced] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (saved.data && !form) setForm(Object.fromEntries(Object.entries(saved.data.plan).filter(([k]) => FIELDS.some((f) => f.key === k)).map(([k, v]) => [k, String(v)])));
  }, [saved.data, form]);
  useEffect(() => { const t = setTimeout(() => setDebounced(form), 350); return () => clearTimeout(t); }, [form]);

  const numeric = useMemo(() => (debounced ? Object.fromEntries(Object.entries(debounced).map(([k, v]) => [k, Number(v)])) : null), [debounced]);
  const valid = !!numeric && Object.values(numeric).every((v) => Number.isFinite(v)) && numeric.retirementAge > numeric.currentAge && numeric.lifeExpectancy > numeric.retirementAge;
  const preview = useQuery({
    queryKey: ["fc", spaceId, "retirement-preview", numeric],
    queryFn: () => post<RetirementResp>("/retirement/project", { spaceId, ...numeric }),
    enabled: valid, placeholderData: keepPreviousData,
  });
  const dirty = !!saved.data && !!form && Object.entries(form).some(([k, v]) => String((saved.data!.plan as any)[k]) !== v);
  const save = useApiMutation(() => put("/retirement", { spaceId, ...Object.fromEntries(Object.entries(form!).map(([k, v]) => [k, Number(v)])) }));
  const result = valid ? preview.data ?? saved.data : saved.data;

  return {
    loading: saved.isLoading || !form, form: form ?? {}, setField: (k: string, v: string) => setForm((f) => ({ ...(f ?? {}), [k]: v })),
    result, valid, dirty, save, reset: () => setForm(null), savedExists: !!saved.data,
  };
}
