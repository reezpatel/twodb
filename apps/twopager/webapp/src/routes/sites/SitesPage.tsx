import { useNavigate, useParams } from "react-router";
import { Plus } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { useSitesPage } from "./hooks/useSitesPage";
import { SitesTable } from "./partials/SitesTable";
import { Page, PageHeader, Spinner } from "../../components/Ui";

export function SitesPage() {
  const { spaceId = "" } = useParams();
  const nav = useNavigate();
  const { sites, isLoading, form, canCreate, create, error } = useSitesPage(spaceId);
  localStorage.setItem("twopager.space", spaceId);

  if (isLoading) return <Spinner />;
  return (
    <Page>
      <PageHeader title="Sites" subtitle={`${sites.length} in this space`} description="Landing pages and static sites for this space. Each site is versioned; one version is live." />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (canCreate) create(); }}>
        <Input value={form.name} onChange={(e) => form.setName(e.target.value)} placeholder="Site name, e.g. Acme landing" aria-label="Site name" />
        <Input value={form.domain} onChange={(e) => form.setDomain(e.target.value)} placeholder="Custom domain (optional)" aria-label="Custom domain" />
        <Button type="submit" disabled={!canCreate}><Plus />Create</Button>
      </form>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <SitesTable sites={sites} onOpen={(id) => nav(`/s/${spaceId}/sites/${id}`)} />
    </Page>
  );
}
