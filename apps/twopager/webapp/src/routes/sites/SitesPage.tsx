import { Link, useParams } from "react-router";
import { ExternalLink, Globe, Plus } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { useSitesPage } from "./hooks/useSitesPage";
import { EmptyState, Page, PageHeader, Spinner } from "../../components/Ui";

export function SitesPage() {
  const { spaceId = "" } = useParams();
  const { sites, isLoading, form, canCreate, create, error } = useSitesPage(spaceId);
  localStorage.setItem("twopager.space", spaceId);

  if (isLoading) return <Spinner />;
  return (
    <Page>
      <PageHeader title="Sites" subtitle="Landing pages and static sites for this space. Each site is versioned; one version is live." />
      <form className="mb-6 grid max-w-2xl gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (canCreate) create(); }}>
        <Input value={form.name} onChange={(e) => form.setName(e.target.value)} placeholder="Site name, e.g. Acme landing" aria-label="Site name" />
        <Input value={form.domain} onChange={(e) => form.setDomain(e.target.value)} placeholder="Custom domain (optional)" aria-label="Custom domain" />
        <Button type="submit" disabled={!canCreate}><Plus />Create</Button>
      </form>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {!sites.length ? <EmptyState title="No sites yet" hint="Create a site, then add pages or upload a zip. Agents can do the same through the API." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((s) => (
            <Link key={s.id} to={`/s/${spaceId}/sites/${s.id}`} className="rounded-md border border-outline bg-card p-4 transition-colors hover:border-ion-deep">
              <div className="flex items-center gap-2"><Globe className="size-4 text-ink-muted" /><span className="font-medium">{s.name}</span>
                <span className={`ml-auto rounded-sm px-1.5 py-0.5 text-xs ${s.activeVersionNumber ? "bg-stone text-ink" : "text-ink-muted"}`}>{s.activeVersionNumber ? `v${s.activeVersionNumber} live` : "unpublished"}</span></div>
              <ul className="mt-2 space-y-0.5 text-sm text-ink-muted">
                {s.hosts.length ? s.hosts.map((h) => <li key={h} className="flex items-center gap-1"><ExternalLink className="size-3" />{h}</li>) : <li>No domain yet</li>}
              </ul>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
