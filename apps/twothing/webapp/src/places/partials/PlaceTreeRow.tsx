import { cn } from "@twodb/blocks";
import { ChevronRight, Plus } from "lucide-react";
import { kindOf } from "../../lib/catalog";
import { navigate } from "../../lib/router";
import type { Place } from "../../lib/types";
import { CodeChip } from "../../ui/CodeChip";
import { Td, Tr } from "../../ui/DataTable";

/** One place as a table row; nesting is shown by indenting the name cell. */
export function PlaceTreeRow({ place, collapsed, onToggle, flat }: { place: Place; collapsed: boolean; onToggle: () => void; flat: boolean }) {
  const kind = kindOf(place.kind);
  const Icon = kind.icon;
  const parentPath =
    flat && place.path.length > 1
      ? place.path
          .slice(0, -1)
          .map((c) => c.name)
          .join(" › ")
      : "";
  return (
    <Tr onClick={() => navigate(`/places/${place.id}`)}>
      <Td>
        <div className="flex items-center gap-1.5" style={{ paddingLeft: flat ? 0 : place.depth * 20 }}>
          <button
            aria-label={collapsed ? "Expand" : "Collapse"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-[4px] text-ink-muted hover:bg-stone",
              (flat || place.childCount === 0) && "invisible",
            )}
          >
            <ChevronRight className={cn("size-3.5 transition", !collapsed && "rotate-90")} />
          </button>
          <Icon className="size-3.5 shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{place.name}</div>
            {parentPath && <div className="truncate text-[11px] font-light text-ink-muted">{parentPath}</div>}
          </div>
        </div>
      </Td>
      <Td hideOnMobile className="text-ink-muted">
        {kind.label}
      </Td>
      <Td hideOnMobile>
        <CodeChip code={place.codeDisplay} muted />
      </Td>
      <Td className="tabular-nums text-ink-muted">
        <span title={`${place.itemCount} directly inside`}>{place.totalItemCount > 0 ? place.totalItemCount : "—"}</span>
      </Td>
      <Td className="w-10 text-right">
        <button
          title="Add a place inside"
          aria-label="Add a place inside"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/places/new?parent=${place.id}`);
          }}
          className="grid size-6 place-items-center rounded-[4px] text-ink-muted opacity-0 transition group-hover:opacity-100 hover:bg-stone hover:text-ink"
        >
          <Plus className="size-3.5" />
        </button>
      </Td>
    </Tr>
  );
}
