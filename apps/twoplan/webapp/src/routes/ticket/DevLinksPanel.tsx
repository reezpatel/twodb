import { useState } from "react";
import { GitBranch, GitCommit, GitPullRequest, Plus, X } from "lucide-react";
import { Section, addBtn } from "./Section";
import { PopoverBox } from "../../components/Picker";
import type { DevLink, TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";

const STATE_CLS: Record<DevLink["state"], string> = { open: "bg-success/20 text-success", draft: "bg-paper-grid text-ink-muted", merged: "bg-ion-deep/20 text-ion-deep", closed: "bg-destructive/20 text-destructive" };
const CI_CLS = { pending: "bg-warning", success: "bg-success", failure: "bg-destructive" } as const;
const KIND_ICON = { pull_request: GitPullRequest, branch: GitBranch, commit: GitCommit } as const;

function AddDevLink({ api }: { api: TicketPageApi }) {
  const [url, setUrl] = useState(""), [title, setTitle] = useState(""), [kind, setKind] = useState("pull_request");
  return (
    <PopoverBox width="w-80" trigger={<button className={addBtn}><Plus className="size-3" />Link PR / branch</button>}>
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); api.dev.add.mutate({ url, title: title || undefined, kind }); setUrl(""); setTitle(""); }}>
        <input autoFocus required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo/pull/12" className="h-8 rounded-sm border border-outline bg-paper px-2 text-sm" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="h-8 rounded-sm border border-outline bg-paper px-2 text-sm" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-sm border border-outline bg-paper px-2 text-sm"><option value="pull_request">Pull request</option><option value="branch">Branch</option><option value="commit">Commit</option></select>
        <button className="h-8 rounded-sm bg-ink text-sm text-paper">Add</button>
      </form>
    </PopoverBox>
  );
}

export function DevLinksPanel({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  return (
    <Section title="Development" count={t.devLinks.length} action={<AddDevLink api={api} />}>
      {t.devLinks.map((d) => { const I = KIND_ICON[d.kind as keyof typeof KIND_ICON] ?? GitPullRequest; return (
        <div key={d.id} className="group flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-stone">
          <I className="size-4 shrink-0 text-ink-muted" />
          <a href={d.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate hover:underline">{d.title}</a>
          {d.ciState ? <span className={`size-2 rounded-full ${CI_CLS[d.ciState]}`} title={`CI ${d.ciState}`} /> : null}
          <select value={d.state} onChange={(e) => api.dev.update.mutate({ id: d.id, state: e.target.value })} className={`rounded-full px-2 py-0.5 text-xs ${STATE_CLS[d.state]}`}>{["open", "draft", "merged", "closed"].map((s) => <option key={s}>{s}</option>)}</select>
          <select value={d.ciState ?? ""} onChange={(e) => api.dev.update.mutate({ id: d.id, ciState: e.target.value || null })} className="rounded-sm bg-transparent text-xs text-ink-muted" aria-label="CI status"><option value="">no CI</option><option value="pending">CI pending</option><option value="success">CI passing</option><option value="failure">CI failing</option></select>
          <button aria-label="Remove" className="hidden rounded-sm p-0.5 text-ink-muted group-hover:block hover:text-destructive" onClick={() => api.dev.remove.mutate(d.id)}><X className="size-3.5" /></button>
        </div>
      ); })}
    </Section>
  );
}
