import { ChevronsUpDown, MapPinOff, ScanLine, X } from "lucide-react";
import { kindOf } from "../../lib/catalog";
import type { Place } from "../../lib/types";

export function PlaceField({ place, onOpen, onScan, onClear, placeholder = "Choose where it lives" }: { place?: Place; onOpen: () => void; onScan: () => void; onClear: () => void; placeholder?: string }) {
  const Icon = place ? kindOf(place.kind).icon : MapPinOff;
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onOpen} className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-outline bg-paper px-3 text-left text-[15px] transition hover:border-ink/30">
        <Icon className="size-4 shrink-0 text-ink-muted" />
        {place ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="text-ink-muted">{place.path.slice(0, -1).map((c) => c.name + " › ")}</span>
            <span className="font-semibold">{place.name}</span>
          </span>
        ) : (
          <span className="flex-1 text-ink-muted">{placeholder}</span>
        )}
        {place ? (
          <X
            className="size-4 shrink-0 text-ink-muted hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" />
        )}
      </button>
      <button type="button" onClick={onScan} title="Scan the box label" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-outline bg-paper px-3 text-sm font-semibold hover:bg-stone active:scale-95">
        <ScanLine className="size-4" /> <span className="hidden sm:inline">Box</span>
      </button>
    </div>
  );
}
