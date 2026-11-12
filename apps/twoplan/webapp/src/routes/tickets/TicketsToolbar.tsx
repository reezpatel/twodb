import { useState } from "react";
import { Bookmark, ChevronDown, GanttChart, KanbanSquare, Plus, Search, Table2 } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@twodb/blocks";
import { FilterBar } from "./FilterBar";
import type { TicketsPageState } from "./useTicketsPage";
import type { GroupBy, Layout, SavedView } from "../../lib/types";

const LAYOUTS: { id: Layout; label: string; icon: typeof Table2 }[] = [{ id: "table", label: "List", icon: Table2 }, { id: "board", label: "Board", icon: KanbanSquare }, { id: "timeline", label: "Timeline", icon: GanttChart }];
const GROUPS: { id: GroupBy | ""; label: string }[] = [{ id: "", label: "No grouping" }, { id: "status", label: "Status" }, { id: "assignee", label: "Assignee" }, { id: "priority", label: "Priority" }, { id: "epic", label: "Epic" }, { id: "milestone", label: "Milestone" }, { id: "type", label: "Type" }];
const SORTS = [["position", "Manual"], ["createdAt", "Created"], ["updatedAt", "Updated"], ["dueDate", "Due date"], ["priority", "Priority"], ["title", "Title"]] as const;

interface Props {
  state: TicketsPageState; views: SavedView[]; total: number | undefined;
  update: (c: Record<string, string | null>, o?: { keepView?: boolean }) => void; clear: () => void; applyView: (v: SavedView | null) => void;
  onSaveView: (name: string) => void; onUpdateView: () => void; onNew: () => void; getParam: (k: string) => string | null;
}

export function TicketsToolbar({ state, views, total, update, clear, applyView, onSaveView, onUpdateView, onNew, getParam }: Props) {
  const [q, setQ] = useState(state.filters.q ?? "");
  const current = views.find((v) => v.id === state.viewId);
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-outline px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-outline p-0.5" role="tablist" aria-label="Layout">
          {LAYOUTS.map(({ id, label, icon: I }) => (
            <button key={id} role="tab" aria-selected={state.layout === id} onClick={() => update({ layout: id === "table" ? null : id, group: null }, { keepView: true })}
              className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm ${state.layout === id ? "bg-paper-grid text-ink" : "text-ink-muted hover:text-ink"}`}><I className="size-4" />{label}</button>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><Bookmark />{current?.name ?? "Views"}<ChevronDown /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => applyView(null)}>All tickets (default)</DropdownMenuItem>
            {views.length ? <DropdownMenuSeparator /> : null}
            {views.map((v) => <DropdownMenuItem key={v.id} onSelect={() => applyView(v)}>{v.name}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            {current ? <DropdownMenuItem onSelect={onUpdateView}>Update “{current.name}” with current filters</DropdownMenuItem> : null}
            <DropdownMenuItem onSelect={() => { const n = prompt("Name this view"); if (n?.trim()) onSaveView(n.trim()); }}>Save current as new view…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <form className="relative" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || null }); }}>
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (state.filters.q ?? "") && update({ q: q.trim() || null })} placeholder="Search title or KEY-12" className="h-8 w-56 rounded-md border border-outline bg-paper pr-2 pl-8 text-sm outline-none focus:border-ion-deep" />
        </form>
        <div className="ml-auto flex items-center gap-2">
          {state.layout === "table" ? (
            <select aria-label="Group by" className="h-8 rounded-md border border-outline bg-paper px-2 text-sm" value={state.group ?? ""} onChange={(e) => update({ group: e.target.value || "none" }, { keepView: true })}>
              {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.id ? `Group: ${g.label}` : g.label}</option>)}
            </select>
          ) : null}
          {state.layout !== "board" ? (
            <select aria-label="Sort" className="h-8 rounded-md border border-outline bg-paper px-2 text-sm" value={`${state.sort}:${state.dir}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); update({ sort: s === "position" ? null : s, dir: d === "asc" ? null : d }, { keepView: true }); }}>
              {SORTS.flatMap(([id, label]) => id === "position" ? [<option key={id} value="position:asc">Sort: {label}</option>] : [<option key={id + "a"} value={`${id}:asc`}>Sort: {label} ↑</option>, <option key={id + "d"} value={`${id}:desc`}>Sort: {label} ↓</option>])}
            </select>
          ) : null}
          <label className="flex items-center gap-1.5 text-xs text-ink-muted"><input type="checkbox" checked={getParam("subtasks") === "1"} onChange={(e) => update({ subtasks: e.target.checked ? "1" : null })} />Sub-tasks</label>
          <span className="text-xs text-ink-muted">{total ?? "…"} tickets</span>
          <Button size="sm" onClick={onNew}><Plus />New ticket</Button>
        </div>
      </div>
      <FilterBar get={getParam} set={(k, v) => update({ [k]: v })} clear={clear} activeCount={state.activeFilterCount} />
    </div>
  );
}
