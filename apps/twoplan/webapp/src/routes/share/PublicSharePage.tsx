import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { RichTextView } from "@twodb/editor";
import { StatusIcon, PriorityIcon, EmptyState, Spinner } from "../../components/Visuals";
import { get } from "../../lib/api";
import { formatDate } from "../../lib/format";
import type { Status } from "../../lib/types";

/** Anonymous read-only view for share links. No member names/ids are ever returned by the API. */
export function PublicSharePage() {
  const { token = "" } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["tp", "public", token], queryFn: () => get<any>(`/public/${token}`), retry: false });
  if (isLoading) return <Spinner />;
  if (error || !data) return <EmptyState title="This link is no longer available" hint="It may have been revoked." />;
  const statuses: Status[] = data.statuses;
  const st = (id: string) => statuses.find((s) => s.id === id);
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 text-sm text-ink-muted"><span className="rounded-sm bg-paper-grid px-1.5 py-0.5 font-mono text-xs">{data.project.key}</span> {data.project.name} · read-only</div>
      {data.kind === "ticket" ? (
        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-semibold"><span className="mr-2 font-mono text-base text-ink-muted">{data.ticket.identifier}</span>{data.ticket.title}</h1>
          <div className="flex items-center gap-3 text-sm"><StatusIcon category={st(data.ticket.statusId)?.category ?? "todo"} color={st(data.ticket.statusId)?.color ?? "#999"} />{st(data.ticket.statusId)?.name}<PriorityIcon priority={data.ticket.priority} />{data.ticket.dueDate ? <span className="text-ink-muted">Due {formatDate(data.ticket.dueDate)}</span> : null}</div>
          {data.ticket.description ? <RichTextView html={data.ticket.description} /> : null}
          {data.checklists.map((c: any) => <div key={c.id}><h3 className="mb-1 font-medium">{c.title}</h3>{c.items.map((i: any) => <div key={i.id} className={`text-sm ${i.done ? "text-ink-muted line-through" : ""}`}>{i.done ? "☑" : "☐"} {i.text}</div>)}</div>)}
          {data.comments.length ? <div className="flex flex-col gap-3"><h3 className="font-medium">Comments</h3>{data.comments.map((c: any) => <div key={c.id} className="rounded-md border border-outline p-3"><RichTextView html={c.body} /></div>)}</div> : null}
        </div>
      ) : (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
          {statuses.map((s) => { const items = data.tickets.filter((t: any) => t.statusId === s.id); return (
            <div key={s.id} className="flex w-64 shrink-0 flex-col gap-2 rounded-md bg-stone/70 p-2">
              <div className="flex items-center gap-2 px-1 text-sm font-medium"><StatusIcon category={s.category} color={s.color} />{s.name}<span className="font-normal text-ink-muted">{items.length}</span></div>
              {items.map((t: any) => <div key={t.id} className="rounded-md border border-outline bg-card p-2.5 text-sm"><div className="mb-1 flex items-center gap-1.5 text-xs text-ink-muted"><span className="font-mono">{t.identifier}</span><span className="ml-auto"><PriorityIcon priority={t.priority} /></span></div>{t.title}</div>)}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
