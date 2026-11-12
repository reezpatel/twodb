import { Dialog, DialogContent, DialogDescription, DialogTitle, cn } from "@twodb/blocks";
import { MapPinOff, ScanLine, Search } from "lucide-react";
import { kindOf } from "../lib/catalog";
import type { Place } from "../lib/types";
import { CodeChip } from "../ui/CodeChip";
import { usePlacePicker } from "./hooks/usePlacePicker";

export function PlacePickerDialog({
  open,
  onOpenChange,
  onPick,
  title = "Choose a place",
  allowNone = true,
  exclude,
  selectedId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (p: Place | null) => void;
  title?: string;
  allowNone?: boolean;
  exclude?: string;
  selectedId?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-lg flex-col gap-3 p-4 sm:p-5">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">Search, browse or scan a place label</DialogDescription>
        {open && <Body onPick={onPick} allowNone={allowNone} exclude={exclude} selectedId={selectedId} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ onPick, allowNone, exclude, selectedId }: { onPick: (p: Place | null) => void; allowNone: boolean; exclude?: string; selectedId?: string | null }) {
  const h = usePlacePicker({ exclude, onPick });
  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-muted" />
          <input autoFocus value={h.q} onChange={(e) => h.setQ(e.target.value)} placeholder="Search places…" className="h-9 w-full rounded-full border border-outline bg-card pr-3 pl-9 text-sm outline-none focus:border-ink/30" />
        </div>
        <button onClick={() => void h.scan()} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 text-sm font-semibold text-paper">
          <ScanLine className="size-4" /> Scan
        </button>
      </div>
      <div className="-mx-1 min-h-40 flex-1 overflow-y-auto px-1">
        {allowNone && !h.searching && (
          <button onClick={() => onPick(null)} className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink-muted hover:bg-stone", selectedId === null && "bg-stone")}>
            <MapPinOff className="size-4" /> No place (unplaced)
          </button>
        )}
        {h.list.map((p) => {
          const Icon = kindOf(p.kind).icon;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className={cn("flex w-full items-center gap-2 rounded-xl py-2 pr-3 text-left text-sm hover:bg-stone", selectedId === p.id && "bg-stone ring-1 ring-ink/20")}
              style={{ paddingLeft: h.searching ? 12 : 12 + p.depth * 18 }}
            >
              <Icon className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate">
                {h.searching ? (
                  <>
                    <span className="text-ink-muted">{p.path.slice(0, -1).map((c) => c.name + " › ")}</span>
                    <span className="font-medium">{p.name}</span>
                  </>
                ) : (
                  <span className="font-medium">{p.name}</span>
                )}
              </span>
              <CodeChip code={p.codeDisplay} muted />
              <span className="w-6 text-right text-xs text-ink-muted tabular-nums">{p.totalItemCount || ""}</span>
            </button>
          );
        })}
        {!h.loading && h.list.length === 0 && <div className="py-8 text-center text-sm text-ink-muted">{h.searching ? "No places match." : "No places yet — create one under Places."}</div>}
      </div>
    </>
  );
}
