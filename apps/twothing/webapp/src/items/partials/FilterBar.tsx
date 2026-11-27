import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@twodb/blocks";
import { ChevronDown, LayoutGrid, List, MapPin, MapPinOff, Star, Tag, TriangleAlert, X } from "lucide-react";
import type { ItemQuery } from "../../lib/api";
import type { Place } from "../../lib/types";
import type { ViewMode } from "../hooks/useItemsPage";

const chip = "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2.5 h-8 text-[12px] font-medium transition whitespace-nowrap";
const on = "border-ink bg-ink text-paper";
const off = "border-outline bg-card text-ink hover:border-ink/30";

const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "updated", label: "Recently changed" },
  { value: "created", label: "Newest" },
  { value: "quantity", label: "Lowest quantity" },
];

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-outline bg-card px-2.5 text-[12px] outline-none transition hover:border-ink/30">
                {SORTS.find((o) => o.value === (filters.sort ?? "name"))?.label}
                <ChevronDown className="size-3.5 text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={filters.sort ?? "name"} onValueChange={(v) => setFilter("sort", v === "name" ? null : v)}>
                {SORTS.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex h-8 items-center gap-1 rounded-[6px] border border-outline bg-card p-[3px]">
            {(["grid", "list"] as const).map((v) => {
              const I = v === "grid" ? LayoutGrid : List;
              return (
                <button
                  key={v}
                  aria-label={`${v} view`}
                  onClick={() => setView(v)}
                  className={cn("grid size-[22px] place-items-center rounded-[4px]", view === v ? "bg-ink text-paper" : "text-ink-muted")}
                >
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
