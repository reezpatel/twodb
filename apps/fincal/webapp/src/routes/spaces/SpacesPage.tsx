import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input } from "@twodb/blocks";
import { useSpaces } from "../../lib/queries";
import { EmptyState, Page, PageHeader, Spinner, errMsg } from "../../components/Ui";

/** Each space is an isolated finance book (e.g. "Personal", "Family", "Business"). Spaces are shared by the whole organisation. */
export function SpacesPage() {
  const { data: spaces, isLoading } = useSpaces();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!spaces?.length) return;
    const last = localStorage.getItem("fincal.space");
    const target = spaces.find((s) => s.id === last) ?? (spaces.length === 1 ? spaces[0] : null);
    if (target) nav(`/s/${target.id}/overview`, { replace: true });
  }, [spaces, nav]);

  async function create() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/registry/spaces", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      if (!r.ok) throw new Error(`Could not create space (${r.status})`);
      const j = await r.json();
      await qc.invalidateQueries({ queryKey: ["fc", "_spaces"] });
      setName("");
      const id = j.id ?? j.space?.id;
      if (id) nav(`/s/${id}/overview`);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  if (isLoading) return <Spinner />;
  return (
    <Page>
      <PageHeader title="Spaces" subtitle="Every space is its own isolated set of accounts, budgets, investments and goals. Everyone in the organisation can open every space." />
      <form className="mb-6 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void create(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={spaces?.length ? "New space, e.g. Family" : "Create your first space, e.g. Personal"} />
        <Button type="submit" disabled={!name.trim() || busy}><Plus />Create</Button>
      </form>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {!spaces?.length ? <EmptyState title="No spaces yet" hint="Create a space to start tracking accounts, expenses, budgets and investments." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <Link key={s.id} to={`/s/${s.id}/overview`} onClick={() => localStorage.setItem("fincal.space", s.id)} className="flex items-center gap-3 rounded-md border border-outline bg-card p-4 transition-colors hover:border-ion-deep">
              <Wallet className="size-5 text-ink-muted" /><span className="font-medium">{s.name}</span>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
