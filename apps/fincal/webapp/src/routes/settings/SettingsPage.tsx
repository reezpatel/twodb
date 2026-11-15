import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { useSpace } from "../../lib/space";
import { useApiMutation, useCategories, useSettings } from "../../lib/queries";
import { del, patch, post, put } from "../../lib/api";
import { PALETTE } from "../../lib/meta";
import { errMsg, Page, PageHeader, Section, selectCls, Spinner, Swatch } from "../../components/Ui";
import type { Category } from "../../lib/types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

function CategoryList({ kind, items }: { kind: "expense" | "income"; items: Category[] }) {
  const { spaceId } = useSpace();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const add = useApiMutation(() => post("/categories", { spaceId, name: name.trim(), kind, color: PALETTE[items.length % PALETTE.length] }), () => setName(""));
  const rename = useApiMutation((v: { id: string; name: string }) => patch(`/categories/${v.id}`, { name: v.name }));
  const recolor = useApiMutation((v: { id: string; color: string }) => patch(`/categories/${v.id}`, { color: v.color }));
  const remove = useApiMutation((id: string) => del(`/categories/${id}`));
  return (
    <Section title={kind === "expense" ? "Expense categories" : "Income categories"}>
      <ul className="mb-3 divide-y divide-outline">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
            <label className="relative cursor-pointer"><Swatch color={c.color} size={16} /><input type="color" value={c.color} onChange={(e) => recolor.mutate({ id: c.id, color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Colour" /></label>
            <input className="min-w-0 flex-1 bg-transparent py-1 outline-none focus:underline" defaultValue={c.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) rename.mutate({ id: c.id, name: v }); else e.target.value = c.name; }} />
            <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} onClick={() => { if (confirm(`Delete “${c.name}”? Its transactions become uncategorized.`)) remove.mutate(c.id); }}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setError(""); if (name.trim()) add.mutate(undefined, { onError: (er) => setError(errMsg(er)) }); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" /><Button type="submit" disabled={!name.trim()}><Plus />Add</Button>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </Section>
  );
}

export function SettingsPage() {
  const { spaceId, spaceName } = useSpace();
  const { data: cats = [], isLoading } = useCategories(spaceId);
  const { data: settings } = useSettings(spaceId);
  const setCurrency = useApiMutation((currency: string) => put("/settings", { spaceId, currency }));
  if (isLoading) return <Spinner />;
  return (
    <Page>
      <PageHeader title="Settings" subtitle={`Space “${spaceName}”`} />
      <Section title="Currency" className="mb-4">
        <div className="flex items-center gap-3">
          <select className={`${selectCls} !w-40`} value={settings?.currency ?? "INR"} onChange={(e) => setCurrency.mutate(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          <p className="text-sm text-ink-muted">Display currency for this space. Amounts aren't converted.</p>
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryList kind="expense" items={cats.filter((c) => c.kind === "expense")} />
        <CategoryList kind="income" items={cats.filter((c) => c.kind === "income")} />
      </div>
    </Page>
  );
}
