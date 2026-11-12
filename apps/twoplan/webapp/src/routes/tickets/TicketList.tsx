import { patch } from "../../lib/api";
import { useApiMutation, useEpics } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { TicketRow } from "./TicketRow";
import { EmptyState } from "../../components/Visuals";
import type { Ticket } from "../../lib/types";

/** Flat editable ticket list (used on epic and milestone pages). */
export function TicketList({ tickets, empty }: { tickets: Ticket[]; empty?: string }) {
  const { project } = useProjectCtx();
  const { data: epics = [] } = useEpics(project.key);
  const upd = useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`/tickets/${v.id}`, v));
  if (!tickets.length) return <EmptyState title={empty ?? "No tickets"} />;
  return <div className="rounded-md border border-outline">{tickets.map((t) => <TicketRow key={t.id} ticket={t} selected={false} onSelect={() => {}} onPatch={(id, b) => upd.mutate({ id, ...b })} epic={epics.find((e) => e.id === t.epicId)} />)}</div>;
}
