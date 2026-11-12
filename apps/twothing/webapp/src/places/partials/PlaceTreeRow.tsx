import { cn } from "@twodb/blocks";
import { ChevronRight, Plus } from "lucide-react";
import { kindOf } from "../../lib/catalog";
import { Link, navigate } from "../../lib/router";
import type { Place } from "../../lib/types";
import { CodeChip } from "../../ui/CodeChip";

export function PlaceTreeRow({ place, collapsed, onToggle, flat }: { place: Place; collapsed: boolean; onToggle: () => void; flat: boolean }) {
  const kind = kindOf(place.kind);
  const Icon = kind.icon;
  return (
    <div className="group flex items-center gap-1 rounded-xl py-1 pr-2 transition hover:bg-stone/60" style={{ paddingLeft: flat ? 8 : 8 + place.depth * 22 }}>
      <button
        aria-label={collapsed ? "Expand" : "Collapse"}
        onClick={onToggle}
        className={cn("grid size-6 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-stone", (flat || place.childCount === 0) && "invisible")}
      >
        <ChevronRight className={cn("size-4 transition", !collapsed && "rotate-90")} />
      </button>
      <Link to={`/places/${place.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 py-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-outline bg-paper">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{place.name}</span>
          {flat && place.path.length > 1 && <span className="block truncate text-xs text-ink-muted">{place.path.slice(0, -1).map((c) => c.name).join(" › ")}</span>}
        </span>
        <span className="hidden text-xs text-ink-muted sm:inline">{kind.label}</span>
      </Link>
      <CodeChip code={place.codeDisplay} muted className="hidden sm:inline-flex" />
      <span className="w-16 text-right text-xs text-ink-muted tabular-nums" title={`${place.itemCount} directly inside`}>
        {place.totalItemCount > 0 ? `${place.totalItemCount} item${place.totalItemCount === 1 ? "" : "s"}` : "empty"}
      </span>
      <button
        title="Add a place inside"
        onClick={() => navigate(`/places/new?parent=${place.id}`)}
        className="grid size-7 place-items-center rounded-full text-ink-muted opacity-0 transition group-hover:opacity-100 hover:bg-paper hover:text-ink"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
