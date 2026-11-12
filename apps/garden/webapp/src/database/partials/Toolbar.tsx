import { useRef, useState } from "react";
import { ArrowUpDown, Filter, Layers, ListFilter, Plus, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { Popover } from "../../ui/Popover";
import { IconButton } from "../../ui/IconButton";
import { countFilters } from "../lib/view-utils";
import { FilterPopover } from "./FilterPopover";
import { SortPopover } from "./SortPopover";
import { GroupPopover } from "./GroupPopover";
import { PropertiesPopover } from "./PropertiesPopover";
import { ViewSettings } from "./ViewSettings";

type Pane = "filter" | "sort" | "group" | "props" | "settings" | null;

/** Right side of the database header: search, filter, sort, group, properties, view settings, New. */
export function Toolbar({ m, compact }: { m: DatabaseViewModel; compact?: boolean }) {
  const [pane, setPane] = useState<Pane>(null);
  const [searching, setSearching] = useState(!!m.search);
  const searchRef = useRef<HTMLInputElement>(null);
  const view = m.view;
  if (!view) return null;
  const nFilters = countFilters(view.config.filter);
  const nSorts = view.config.sorts?.length ?? 0;
  const open = (p: Pane) => (o: boolean) => setPane(o ? p : null);
  const groupable = view.type !== "gallery" && view.type !== "calendar";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {searching ? (
        <div className="flex h-7 items-center gap-1 rounded-md bg-ink/[0.05] px-2">
          <Search size={13} className="text-ink-muted" />
          <input
            ref={searchRef}
            autoFocus
            value={m.search}
            onChange={(e) => m.setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (m.setSearch(""), setSearching(false))}
            placeholder="Search…"
            className="w-[120px] bg-transparent text-[13px] outline-none placeholder:text-ink-muted"
          />
          <button type="button" onClick={() => (m.setSearch(""), setSearching(false))} className="text-ink-muted hover:text-ink" aria-label="Close search">
            <X size={13} />
          </button>
        </div>
      ) : (
        <IconButton title="Search" onClick={() => setSearching(true)}>
          <Search size={15} />
        </IconButton>
      )}

      <Popover
        open={pane === "filter"}
        onOpenChange={open("filter")}
        align="end"
        trigger={
          <button type="button" className={cn("flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] hover:bg-ink/[0.06]", nFilters ? "text-ion-deep" : "text-ink-muted hover:text-ink")} title="Filter">
            {nFilters ? <ListFilter size={15} /> : <Filter size={15} />}
            {nFilters && !compact ? <span>{nFilters}</span> : null}
          </button>
        }
      >
        <FilterPopover fields={m.fields} filter={view.config.filter} onSave={(filter) => void m.updateConfig({ filter })} />
      </Popover>

      <Popover
        open={pane === "sort"}
        onOpenChange={open("sort")}
        align="end"
        trigger={
          <button type="button" className={cn("flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] hover:bg-ink/[0.06]", nSorts ? "text-ion-deep" : "text-ink-muted hover:text-ink")} title="Sort">
            <ArrowUpDown size={15} />
            {nSorts && !compact ? <span>{nSorts}</span> : null}
          </button>
        }
      >
        <SortPopover fields={m.fields} sorts={view.config.sorts ?? []} onSave={(sorts) => void m.updateConfig({ sorts })} />
      </Popover>

      {groupable ? (
        <Popover
          open={pane === "group"}
          onOpenChange={open("group")}
          align="end"
          trigger={
            <IconButton title="Group" className={view.config.groupBy ? "text-ion-deep" : undefined}>
              <Layers size={15} />
            </IconButton>
          }
        >
          <GroupPopover fields={m.fields} groupBy={view.config.groupBy} required={view.type === "kanban"} onSave={(groupBy) => void m.updateConfig({ groupBy })} />
        </Popover>
      ) : null}

      <Popover
        open={pane === "props"}
        onOpenChange={open("props")}
        align="end"
        trigger={
          <IconButton title="Properties">
            <SlidersHorizontal size={15} />
          </IconButton>
        }
      >
        <PropertiesPopover m={m} />
      </Popover>

      <Popover
        open={pane === "settings"}
        onOpenChange={open("settings")}
        align="end"
        trigger={
          <IconButton title="View settings">
            <Settings2 size={15} />
          </IconButton>
        }
      >
        <ViewSettings m={m} onClose={() => setPane(null)} />
      </Popover>

      <button
        type="button"
        onClick={() => void m.addRow({}, { open: view.type !== "table" })}
        className="ml-1 flex h-7 items-center gap-1 rounded-md bg-ink px-2.5 text-[13px] font-semibold text-paper hover:opacity-90"
      >
        <Plus size={14} strokeWidth={2.5} /> New
      </button>
    </div>
  );
}
