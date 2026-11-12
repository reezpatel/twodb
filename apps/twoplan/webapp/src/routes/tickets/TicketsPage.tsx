import { useState } from "react";
import { useSearchParams } from "react-router";
import { useTicketsPage } from "./useTicketsPage";
import { TicketsToolbar } from "./TicketsToolbar";
import { TableView } from "./TableView";
import { BoardView } from "./BoardView";
import { TimelineView } from "./TimelineView";
import { CreateTicketDialog, type TicketDefaults } from "./CreateTicketDialog";
import { Spinner } from "../../components/Visuals";

export function TicketsPage() {
  const p = useTicketsPage();
  const [sp] = useSearchParams();
  const [create, setCreate] = useState<{ open: boolean; defaults: TicketDefaults }>({ open: false, defaults: {} });
  const items = p.tickets.data?.items ?? [];
  const patchTicket = (id: string, body: Record<string, unknown>) => p.patchTicket.mutate({ id, ...body });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TicketsToolbar state={p.state} views={p.views} total={p.tickets.data?.total} update={p.update} clear={p.clearFilters} applyView={p.applyView}
        onSaveView={(n) => p.saveView.mutate(n)} onUpdateView={() => p.updateView.mutate()} onNew={() => setCreate({ open: true, defaults: {} })} getParam={(k) => sp.get(k)} />
      {p.tickets.isLoading ? <Spinner /> : p.state.layout === "board" ? (
        <BoardView tickets={items} onMove={(id, statusId, position) => patchTicket(id, { statusId, position })} onCreateIn={(statusId) => setCreate({ open: true, defaults: { statusId } })} />
      ) : p.state.layout === "timeline" ? (
        <TimelineView tickets={items} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <TableView tickets={items} group={p.state.group} onPatch={patchTicket} onCreateIn={(statusId, by) => setCreate({ open: true, defaults: by === "status" ? { statusId } : {} })} />
        </div>
      )}
      <CreateTicketDialog open={create.open} onOpenChange={(o) => setCreate((c) => ({ ...c, open: o }))} defaults={create.defaults} />
    </div>
  );
}
