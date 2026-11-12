import { useRef, useState } from "react";
import { Copy, Download, Trash2, Upload } from "lucide-react";
import { Button, Input, Label } from "@twodb/blocks";
import { Group, rowCls } from "./parts";
import { del, exportUrl, post } from "../../lib/api";
import { useApiMutation, useShareLinks } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { formatDate } from "../../lib/format";

function CsvImport() {
  const { project } = useProjectCtx();
  const file = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ imported: number; failed: { row: number; error: string }[] } | null>(null);
  const imp = useApiMutation((csv: string) => post<{ imported: number; failed: { row: number; error: string }[] }>(`/projects/${project.key}/import/csv`, { csv }), { onSuccess: setResult });
  return (
    <div className="flex flex-col gap-2">
      <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) imp.mutate(await f.text()); }} />
      <div className="flex items-center gap-2"><Button size="sm" variant="secondary" onClick={() => file.current?.click()} disabled={imp.isPending}><Upload />Import CSV…</Button><span className="text-xs text-ink-muted">Columns: title, description, status, type, priority, epic, milestone, labels (a|b), points, startDate, dueDate</span></div>
      {imp.error ? <p className="text-sm text-destructive">{(imp.error as Error).message}</p> : null}
      {result ? <div className="rounded-md border border-outline p-3 text-sm"><div>Imported <b>{result.imported}</b> ticket(s).</div>{result.failed.length ? <ul className="mt-1 list-disc pl-5 text-destructive">{result.failed.slice(0, 10).map((f) => <li key={f.row}>Row {f.row}: {f.error}</li>)}</ul> : null}</div> : null}
    </div>
  );
}

function LinearImport() {
  const { project } = useProjectCtx();
  const [apiKey, setApiKey] = useState(""), [team, setTeam] = useState("");
  const imp = useApiMutation(() => post<Record<string, number>>(`/projects/${project.key}/import/linear`, { apiKey, teamKey: team }), { onSuccess: () => setApiKey("") });
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); imp.mutate(); }}>
      <div className="flex gap-2"><div className="w-32"><Label>Linear team key</Label><Input value={team} onChange={(e) => setTeam(e.target.value.toUpperCase())} placeholder="ENG" /></div><div className="max-w-sm flex-1"><Label>Personal API key</Label><Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="lin_api_…" autoComplete="off" /></div></div>
      <div className="flex items-center gap-2"><Button type="submit" size="sm" variant="secondary" disabled={!apiKey || !team || imp.isPending}>{imp.isPending ? "Importing…" : "Import from Linear"}</Button><span className="text-xs text-ink-muted">Cycles → milestones, projects → epics. The key is never stored. Use a fresh project.</span></div>
      {imp.error ? <p className="text-sm text-destructive">{(imp.error as Error).message}</p> : null}
      {imp.data ? <p className="text-sm">Imported {imp.data.tickets} tickets, {imp.data.epics} epics, {imp.data.milestones} milestones, {imp.data.labels} labels.</p> : null}
    </form>
  );
}

export function DataSettings() {
  const { project } = useProjectCtx();
  const { data: links = [] } = useShareLinks(project.key);
  const create = useApiMutation(() => post(`/projects/${project.key}/share`, {}));
  const revoke = useApiMutation((id: string) => del(`/projects/${project.key}/share/${id}`));
  const url = (token: string) => `${location.origin}/share/${token}`;
  return (
    <>
      <Group title="Export" hint="Download this project's tickets (names, not ids — the file round-trips through import).">
        <div className="flex gap-2"><Button size="sm" variant="secondary" asChild><a href={exportUrl(project.key, "csv")}><Download />CSV</a></Button><Button size="sm" variant="secondary" asChild><a href={exportUrl(project.key, "json")}><Download />JSON</a></Button></div>
      </Group>
      <Group title="Import"><CsvImport /><div className="mt-4 border-t border-outline pt-4"><LinearImport /></div></Group>
      <Group title="Public links" hint="Anyone with a link can view the board read-only (no sign-in, no member names). Revoke any time." action={<Button size="sm" onClick={() => create.mutate()}>Create link</Button>}>
        <div className="flex flex-col gap-1.5">
          {links.filter((l) => !l.ticketId).map((l) => <div key={l.id} className={rowCls}><span className="min-w-0 flex-1 truncate font-mono text-xs">{url(l.token)}</span><span className="text-xs text-ink-muted">{formatDate(l.createdAt.slice(0, 10), true)}</span><button className="rounded-sm p-1 hover:bg-paper-grid" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(url(l.token))}><Copy className="size-3.5" /></button><button className="rounded-sm p-1 text-ink-muted hover:text-destructive" aria-label="Revoke link" onClick={() => revoke.mutate(l.id)}><Trash2 className="size-3.5" /></button></div>)}
          {!links.some((l) => !l.ticketId) ? <p className="text-sm text-ink-muted">No board links yet. Single-ticket links are created from a ticket's “…” menu.</p> : null}
        </div>
      </Group>
    </>
  );
}
