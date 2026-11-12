import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FileText, Plus, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Spinner } from "../../components/Visuals";
import { Picker, triggerCls } from "../../components/Picker";
import { del, get, patch, post, put } from "../../lib/api";
import { useApiMutation, useDocs, useSearch } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { timeAgo } from "../../lib/format";
import type { Doc } from "../../lib/types";

function TicketLinks({ doc }: { doc: Doc }) {
  const { project } = useProjectCtx();
  const { data } = useQuery({ queryKey: ["tp", "doctickets", doc.id], queryFn: () => get<{ ticketIds: string[] }>(`/projects/${project.key}/documents/${doc.id}/tickets`) });
  const [q, setQ] = useState("");
  const { data: found } = useSearch(q);
  const save = useApiMutation((ids: string[]) => put(`/projects/${project.key}/documents/${doc.id}/tickets`, { ticketIds: ids }));
  const ids = data?.ticketIds ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-ink-muted">Linked tickets:</span>
      {ids.map((id) => <button key={id} onClick={() => save.mutate(ids.filter((x) => x !== id))} title="Click to unlink" className="rounded-full border border-outline px-2 py-0.5 font-mono text-xs hover:border-destructive">{id.slice(-6)} ×</button>)}
      <Picker value={null} onChange={(v) => v && save.mutate([...new Set([...ids, v])])} searchable placeholder="Search tickets…"
        options={(found?.tickets ?? []).map((t) => ({ id: t.id, label: t.title, hint: t.identifier }))}
        footer={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="w-full bg-transparent px-2 py-1 text-sm outline-none" />}
        trigger={<button className={triggerCls}><Plus className="size-3.5" />Link ticket</button>} />
    </div>
  );
}

function DocEditor({ doc }: { doc: Doc }) {
  const { project } = useProjectCtx();
  const nav = useNavigate();
  const [title, setTitle] = useState(doc.title);
  useEffect(() => setTitle(doc.title), [doc.id, doc.title]);
  const save = useApiMutation((b: Record<string, unknown>) => patch(`/projects/${project.key}/documents/${doc.id}`, b), { invalidate: false });
  const remove = useApiMutation(() => del(`/projects/${project.key}/documents/${doc.id}`), { onSuccess: () => nav("../docs") });
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-8 py-6">
      <div className="flex items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== doc.title && save.mutate({ title: title.trim() })} className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Title" />
        <span className="text-xs text-ink-muted">Updated {timeAgo(doc.updatedAt)}</span>
        <Button size="sm" variant="ghost" className="text-destructive" aria-label="Delete document" onClick={() => confirm(`Delete “${doc.title}”?`) && remove.mutate()}><Trash2 /></Button>
      </div>
      <RichTextEditor key={doc.id} value={doc.content} placeholder={doc.kind === "note" ? "Jot something down…" : "Start writing…"} onBlur={(html) => html !== doc.content && save.mutate({ content: html })} />
      <TicketLinks doc={doc} />
    </div>
  );
}

/** Docs (structured pages) and Notes (quick scratch) share one editor; the sidebar lists both. */
export function DocsPage() {
  const { project } = useProjectCtx();
  const { id } = useParams();
  const nav = useNavigate();
  const { data: docs, isLoading } = useDocs(project.key);
  const create = useApiMutation((kind: "doc" | "note") => post<Doc>(`/projects/${project.key}/documents`, { title: kind === "note" ? "Untitled note" : "Untitled doc", kind }), { onSuccess: (d) => nav(d.id) });
  if (isLoading) return <Spinner />;
  const current = docs?.find((d) => d.id === id);
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-outline p-3">
        <div className="mb-1 flex gap-1"><Button size="sm" variant="secondary" className="flex-1" onClick={() => create.mutate("doc")}><FileText />Doc</Button><Button size="sm" variant="secondary" className="flex-1" onClick={() => create.mutate("note")}><StickyNote />Note</Button></div>
        {(docs ?? []).map((d) => <Link key={d.id} to={d.id} className={`flex items-center gap-2 truncate rounded-sm px-2 py-1.5 text-sm ${d.id === id ? "bg-stone" : "hover:bg-stone"}`}>{d.kind === "note" ? <StickyNote className="size-4 shrink-0 text-ink-muted" /> : <FileText className="size-4 shrink-0 text-ink-muted" />}<span className="truncate">{d.title}</span></Link>)}
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto">{current ? <DocEditor key={current.id} doc={current} /> : <EmptyState title={docs?.length ? "Select a document" : "No docs yet"} hint="Docs hold specs and decisions; notes are quick scratch pads. Both can link to tickets." />}</div>
    </div>
  );
}
