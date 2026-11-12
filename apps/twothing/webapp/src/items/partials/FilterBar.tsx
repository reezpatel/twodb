import { cn } from "@twodb/blocks";
import { LayoutGrid, List, MapPin, MapPinOff, Star, Tag, TriangleAlert, X } from "lucide-react";
import { CATEGORIES } from "../../lib/catalog";
import type { ItemQuery } from "../../lib/api";
import type { Place } from "../../lib/types";
import type { ViewMode } from "../hooks/useItemsPage";

const chip = "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition whitespace-nowrap";
const on = "border-ink bg-ink text-paper";
const off = "border-outline bg-card text-ink hover:border-ink/30";

export function FilterBar({
  filters,
  filterPlace,
  setFilter,
  toggle,
  view,
  setView,
}: {
  filters: ItemQuery;
  filterPlace?: Place;
  setFilter: (k: string, v: string | null) => void;
  toggle: (k: "low" | "unplaced" | "favorite") => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <button className={cn(chip, !filters.category ? on : off)} onClick={() => setFilter("category", null)}>
          All
        </button>
        {CATEGORIES.map((c) => {
          const active = filters.category === c.id;
          return (
            <button key={c.id} className={cn(chip, active ? on : off)} onClick={() => setFilter("category", active ? null : c.id)}>
              <c.icon className="size-3.5" style={{ color: active ? undefined : c.color }} />
              {c.short}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={cn(chip, filters.low ? "border-destructive bg-destructive text-destructive-foreground" : off)} onClick={() => toggle("low")}>
          <TriangleAlert className="size-3.5" /> Low stock
        </button>
        <button className={cn(chip, filters.unplaced ? on : off)} onClick={() => toggle("unplaced")}>
          <MapPinOff className="size-3.5" /> Unplaced
        </button>
        <button className={cn(chip, filters.favorite ? "border-amber-500 bg-amber-500 text-white" : off)} onClick={() => toggle("favorite")}>
          <Star className="size-3.5" /> Starred
        </button>
        {filterPlace && (
          <span className={cn(chip, on)}>
            <MapPin className="size-3.5" /> in {filterPlace.name}
            <X className="size-3.5 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setFilter("locationId", null)} />
          </span>
        )}
        {filters.tag && (
          <span className={cn(chip, on)}>
            <Tag className="size-3.5" /> {filters.tag}
            <X className="size-3.5 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setFilter("tag", null)} />
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filters.sort ?? "name"}
            onChange={(e) => setFilter("sort", e.target.value === "name" ? null : e.target.value)}
            className="h-8 rounded-full border border-outline bg-card px-3 text-[13px] outline-none"
          >
            <option value="name">Name A–Z</option>
            <option value="updated">Recently changed</option>
            <option value="created">Newest</option>
            <option value="quantity">Lowest quantity</option>
          </select>
          <div className="flex rounded-full border border-outline bg-card p-0.5">
            {(["grid", "list"] as const).map((v) => {
              const I = v === "grid" ? LayoutGrid : List;
              return (
                <button key={v} aria-label={`${v} view`} onClick={() => setView(v)} className={cn("grid size-7 place-items-center rounded-full", view === v ? "bg-ink text-paper" : "text-ink-muted")}>
                  <I className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
