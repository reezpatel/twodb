import { useRef } from "react";
import { Link, useParams } from "react-router";
import { ExternalLink, Upload } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useSitePage } from "./hooks/useSitePage";
import { VersionsPanel } from "./partials/VersionsPanel";
import { FilesPanel } from "./partials/FilesPanel";
import { DomainsPanel } from "./partials/DomainsPanel";
import { ConfigPanel } from "./partials/ConfigPanel";
import { Page, PageHeader, Segmented, Spinner } from "../../components/Ui";

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
        subtitle={site.activeVersionNumber ? `v${site.activeVersionNumber} is live` : "Not published yet"}
        actions={<>
          {live && site.activeVersionNumber ? <a href={`https://${live}`} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink />Open</Button></a> : null}
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.upload(f); e.target.value = ""; }} />
          <Button onClick={() => fileInput.current?.click()} disabled={actions.uploading}><Upload />{actions.uploading ? "Uploading…" : "Upload zip"}</Button>
          <Button variant="ghost" onClick={() => { if (confirm(`Delete "${site.name}" and all its versions?`)) actions.removeSite(); }}>Delete site</Button>
        </>}
      />
      {p.error ? <p className="mb-4 text-sm text-destructive" role="alert">{p.error}</p> : null}
      <div className="mb-4"><Segmented value={p.tab} onChange={p.setTab} options={[{ id: "versions", label: "Versions" }, { id: "files", label: "Files" }, { id: "config", label: "Rewrite rules" }, { id: "domains", label: "Domains" }]} /></div>
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
