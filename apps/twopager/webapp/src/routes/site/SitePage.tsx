import { useRef } from "react";
import { Link, useParams } from "react-router";
import { ExternalLink, Trash2, Upload } from "lucide-react";
import type { Tab } from "./hooks/useSitePage";
import { Button, Tabs, TabsList, TabsTrigger } from "@twodb/blocks";
import { useSitePage } from "./hooks/useSitePage";
import { VersionsPanel } from "./partials/VersionsPanel";
import { FilesPanel } from "./partials/FilesPanel";
import { DomainsPanel } from "./partials/DomainsPanel";
import { ConfigPanel } from "./partials/ConfigPanel";
import { Page, PageHeader, Spinner } from "../../components/Ui";

export function SitePage() {
  const { spaceId = "", siteId = "" } = useParams();
  const p = useSitePage(siteId, spaceId);
  const fileInput = useRef<HTMLInputElement>(null);

  if (p.isLoading) return <Spinner />;
  if (!p.site) return <Page><p className="text-sm text-destructive">{p.error || "Site not found."}</p><Link to={`/s/${spaceId}`} className="text-sm underline">Back to sites</Link></Page>;
  const { site, actions } = p;
  const live = site.hosts[0];

  return (
    <Page wide>
      <PageHeader
        title={site.name}
        subtitle={site.activeVersionNumber ? `v${site.activeVersionNumber} live` : "not published"}
        actions={<>
          {live && site.activeVersionNumber ? <a href={`https://${live}`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" aria-label="Open site"><ExternalLink /><span className="hidden sm:inline">Open</span></Button></a> : null}
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.upload(f); e.target.value = ""; }} />
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={actions.uploading} aria-label="Upload zip"><Upload /><span className="hidden sm:inline">{actions.uploading ? "Uploading…" : "Upload zip"}</span></Button>
          <Button size="sm" variant="ghost" aria-label="Delete site" onClick={() => { if (confirm(`Delete "${site.name}" and all its versions?`)) actions.removeSite(); }}><Trash2 /><span className="hidden sm:inline">Delete</span></Button>
        </>}
      />
      {p.error ? <p className="mb-4 text-sm text-destructive" role="alert">{p.error}</p> : null}
      <Tabs value={p.tab} onValueChange={(v) => p.setTab(v as Tab)} className="mb-4 gap-0">
        <TabsList variant="line" size="md" className="overflow-x-auto [scrollbar-width:none]">
          {([["versions", "Versions"], ["files", "Files"], ["config", "Rewrite rules"], ["domains", "Domains"]] as const).map(([id, label]) => (
            <TabsTrigger key={id} value={id} className="px-1 pb-2">{label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {p.tab === "versions" ? (
        <VersionsPanel versions={p.versions} selectedId={p.version?.id ?? null} onSelect={(id) => { p.selectVersion(id); p.setTab("files"); }} onActivate={actions.activate} onFinalize={actions.finalize} onDraftFrom={actions.draftFrom} onDelete={actions.removeVersion} />
      ) : null}
      {p.tab === "files" ? (
        <FilesPanel version={p.version} isDraft={p.isDraft} path={p.path} file={p.file} text={p.text} onText={p.setText} onOpen={p.setPath} onSave={actions.saveFile} onRemove={actions.removeFile} onDraftFrom={actions.draftFrom} />
      ) : null}
      {p.tab === "config" ? <ConfigPanel version={p.version} isDraft={p.isDraft} onSave={actions.saveConfig} /> : null}
      {p.tab === "domains" ? <DomainsPanel hosts={site.hosts} domains={site.domains} onAdd={actions.addDomain} onRemove={actions.removeDomain} /> : null}
    </Page>
  );
}
