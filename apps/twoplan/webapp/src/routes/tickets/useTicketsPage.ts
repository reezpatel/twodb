import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { patch, post } from "../../lib/api";
import { useApiMutation, useTickets, useViews, type TicketQuery } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import type { GroupBy, Layout, SavedView, Ticket, TicketFilters } from "../../lib/types";

const FILTER_PARAMS: Record<string, keyof TicketFilters> = { status: "statusId", category: "statusCategory", assignee: "assigneeUserId", priority: "priority", type: "typeId", epic: "epicId", milestone: "milestoneId", label: "labelId", q: "q" };
export const FILTER_KEYS = Object.keys(FILTER_PARAMS);

export interface TicketsPageState {
  layout: Layout; group: GroupBy | null; sort: string; dir: "asc" | "desc"; viewId: string | null;
  filters: TicketFilters; activeFilterCount: number;
}

/** Holding hook: the URL is the single source of truth for layout/filters/sort/group (shareable, back-button friendly). */
export function useTicketsPage() {
  const { project } = useProjectCtx();
  const [sp, setSp] = useSearchParams();
  const { data: views = [] } = useViews(project.key);

  const state = useMemo<TicketsPageState>(() => {
    const filters: TicketFilters = { parentId: sp.get("subtasks") === "1" ? undefined : "none" };
    for (const [param, key] of Object.entries(FILTER_PARAMS)) { const v = sp.get(param); if (v) (filters as any)[key] = v; }
    const layout = (sp.get("layout") as Layout) || "table";
    return {
      layout, filters, viewId: sp.get("view"),
      group: sp.get("group") === "none" ? null : (sp.get("group") as GroupBy) || (layout === "table" ? "status" : null),
      sort: sp.get("sort") || "position", dir: (sp.get("dir") as "asc" | "desc") || "asc",
      activeFilterCount: FILTER_KEYS.filter((k) => sp.get(k)).length,
    };
  }, [sp]);

  const update = useCallback((changes: Record<string, string | null>, opts?: { keepView?: boolean }) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) (v === null || v === "" ? next.delete(k) : next.set(k, v));
      if (!opts?.keepView) next.delete("view");
      return next;
    }, { replace: true });
  }, [setSp]);

  // The board is always manually ordered (drag & drop writes `position`).
  const query: TicketQuery = { ...state.filters, sort: state.layout === "board" ? "position" : state.sort, dir: state.layout === "board" ? "asc" : state.dir };
  // Timeline needs sub-tasks excluded too; the board shows top-level tickets only (sub-tasks live on their parent card).
  const tickets = useTickets(project.key, query);

  const clearFilters = () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));

  const applyView = (v: SavedView | null) => {
    if (!v) { setSp({}, { replace: true }); return; }
    const next: Record<string, string> = { layout: v.layout, view: v.id, sort: v.sortBy, dir: v.sortDir };
    if (v.groupBy) next.group = v.groupBy;
    for (const [param, key] of Object.entries(FILTER_PARAMS)) { const val = (v.filters as any)[key]; if (val) next[param] = String(val); }
    setSp(next, { replace: true });
  };

  const currentViewPayload = () => {
    const filters: Record<string, string> = {};
    for (const [param, key] of Object.entries(FILTER_PARAMS)) { const v = sp.get(param); if (v) filters[key] = v; }
    return { layout: state.layout, filters, sortBy: state.sort, sortDir: state.dir, groupBy: state.group };
  };

  const saveView = useApiMutation((name: string) => post<SavedView>(`/projects/${project.key}/views`, { name, ...currentViewPayload() }), { onSuccess: (v) => update({ view: v.id }, { keepView: true }) });
  const updateView = useApiMutation(() => patch(`/projects/${project.key}/views/${state.viewId}`, currentViewPayload()));

  const patchTicket = useApiMutation(({ id, ...body }: { id: string } & Record<string, unknown>) => patch<Ticket>(`/tickets/${id}`, body));

  return { project, state, update, views, tickets, clearFilters, applyView, saveView, updateView, patchTicket };
}
