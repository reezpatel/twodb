import { useState } from "react";
import { Link } from "react-router";
import { Link2, Plus, X } from "lucide-react";
import { Section, addBtn } from "./Section";
import { PopoverBox } from "../../components/Picker";
import { StatusIcon } from "../../components/Visuals";
import { RELATIONS } from "../../lib/meta";
import { useSearch } from "../../lib/queries";
import type { TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";

const label = (relation: string, direction: string) => { const r = RELATIONS.find((x) => x.id === relation)!; return direction === "outgoing" ? r.label : r.inverse; };

function AddLink({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  const [relation, setRelation] = useState<string>("relates_to");
  const [q, setQ] = useState("");
  const { data } = useSearch(q);
  return (
    <PopoverBox width="w-80" trigger={<button className={addBtn}><Plus className="size-3" />Link</button>}>
      <select value={relation} onChange={(e) => setRelation(e.target.value)} className="mb-2 h-8 w-full rounded-sm border border-outline bg-paper px-2 text-sm">{RELATIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket or KEY-12…" className="mb-1 h-8 w-full rounded-sm border border-outline bg-paper px-2 text-sm" />
      <div className="max-h-48 overflow-y-auto">
        {(data?.tickets ?? []).filter((x) => x.id !== t.id).map((x) => <button key={x.id} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-paper-grid" onClick={() => { api.links.add.mutate({ targetTicketId: x.id, relation }); setQ(""); }}><span className="font-mono text-xs text-ink-muted">{x.identifier}</span><span className="truncate">{x.title}</span></button>)}
      </div>
      {api.links.add.error ? <p className="mt-1 text-xs text-destructive">{(api.links.add.error as Error).message}</p> : null}
    </PopoverBox>
  );
}

export function LinksPanel({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  return (
    <Section title="Linked tickets" count={t.links.length} action={<AddLink t={t} api={api} />}>
      {t.links.map((l) => (
        <div key={l.id} className="group flex items-center gap-2 rounded-sm px-1 py-0.5 text-sm hover:bg-stone">
          <Link2 className="size-3.5 text-ink-muted" /><span className="w-24 shrink-0 text-xs text-ink-muted">{label(l.relation, l.direction)}</span>
          {l.ticket.statusCategory ? <StatusIcon category={l.ticket.statusCategory} color="#9ca3af" /> : null}
          <span className="font-mono text-xs text-ink-muted">{l.ticket.identifier}</span>
          <Link to={`/t/${l.ticket.identifier}`} className="min-w-0 flex-1 truncate hover:underline">{l.ticket.title}</Link>
          <button aria-label="Remove link" className="hidden rounded-sm p-0.5 text-ink-muted group-hover:block hover:text-destructive" onClick={() => api.links.remove.mutate(l.id)}><X className="size-3.5" /></button>
        </div>
      ))}
    </Section>
  );
}
