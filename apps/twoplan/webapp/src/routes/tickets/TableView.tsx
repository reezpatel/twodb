import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Checkbox } from "@twodb/blocks";
import { TicketRow } from "./TicketRow";
import { BulkBar } from "./BulkBar";
import { groupTickets } from "./grouping";
import { EmptyState } from "../../components/Visuals";
import { useProjectCtx } from "../../lib/project-context";
import { useMembers } from "../../lib/members";
import { useEpics, useMilestones, useApiMutation } from "../../lib/queries";
import { post } from "../../lib/api";
import type { GroupBy, Ticket } from "../../lib/types";

interface Props {
  tickets: Ticket[]; group: GroupBy | null; onPatch: (id: string, body: Record<string, unknown>) => void;
  onCreateIn: (groupId: string, by: GroupBy | null) => void;
}

export function TableView({ tickets, group, onPatch, onCreateIn }: Props) {
  const { project, config } = useProjectCtx();
  const { members } = useMembers();
  const { data: epics = [] } = useEpics(project.key);
  const { data: milestones = [] } = useMilestones(project.key);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulk = useApiMutation((b: Record<string, unknown>) => post(`/projects/${project.key}/tickets/bulk`, { ticketIds: [...selected], ...b }), { onSuccess: () => setSelected(new Set()) });

  if (!tickets.length) return <EmptyState title="No tickets match" hint="Adjust the filters, or create a ticket with the New ticket button." />;
  const groups = groupTickets(tickets, group, { config, members, epics, milestones });
  const epicById = new Map(epics.map((e) => [e.id, e]));
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const toggleGroup = (g: Ticket[], on: boolean) => setSelected((s) => { const n = new Set(s); g.forEach((t) => (on ? n.add(t.id) : n.delete(t.id))); return n; });

  return (
    <div className="flex flex-1 flex-col pb-16">
      {groups.map((g) => {
        const open = !collapsed.has(g.id);
        const all = g.tickets.length > 0 && g.tickets.every((t) => selected.has(t.id));
        return (
          <section key={g.id}>
            <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-outline/60 bg-stone px-3 text-sm font-medium">
              <Checkbox checked={all} disabled={!g.tickets.length} onCheckedChange={(v) => toggleGroup(g.tickets, v === true)} aria-label={`Select all in ${g.label}`} />
              <button className="flex items-center gap-2" onClick={() => setCollapsed((c) => { const n = new Set(c); open ? n.add(g.id) : n.delete(g.id); return n; })}>
                <ChevronRight className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} />{g.icon}{g.label}
                <span className="font-normal text-ink-muted">{g.tickets.length}</span>
              </button>
              {group === "status" || !group ? <button className="ml-auto rounded-sm p-1 text-ink-muted hover:bg-paper-grid" aria-label={`Add ticket to ${g.label}`} onClick={() => onCreateIn(g.id, group)}><Plus className="size-4" /></button> : null}
            </div>
            {open ? g.tickets.map((t) => <TicketRow key={t.id} ticket={t} selected={selected.has(t.id)} onSelect={toggle} onPatch={onPatch} epic={t.epicId ? epicById.get(t.epicId) : undefined} />) : null}
          </section>
        );
      })}
      {selected.size ? (
        <BulkBar count={selected.size} statusId={config.statuses[0]?.id ?? ""} onClear={() => setSelected(new Set())}
          onApply={(patch) => bulk.mutate({ patch })} onArchive={() => bulk.mutate({ action: "archive" })}
          onDelete={() => { if (confirm(`Permanently delete ${selected.size} ticket(s)?`)) bulk.mutate({ action: "delete" }); }} />
      ) : null}
    </div>
  );
}
