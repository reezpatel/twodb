import { cn } from "@twodb/blocks";
import { ArrowRight, Barcode, PackagePlus, QrCode, Sparkles, Waypoints } from "lucide-react";
import { kindOf } from "../lib/catalog";
import { displayCode } from "../lib/format";
import type { Item, Place, ResolveMatch } from "../lib/types";
import { CodeChip } from "./CodeChip";
import { ItemThumb } from "./ItemThumb";
import { PlacePath } from "./PlacePath";
import { QtyStepper } from "./QtyStepper";

export interface MatchHandlers {
  onOpenItem: (item: Item) => void;
  onOpenPlace: (place: Place) => void;
  onDelta?: (item: Item, d: number) => void;
  onPutAwayInto?: (place: Place) => void;
  onNewItem: (opts: { code?: string; barcode?: string }) => void;
  onNewPlace: (opts: { code: string }) => void;
  onChoose?: (item: Item) => void;
}

const card = "flex items-center gap-3 rounded-2xl border border-outline bg-paper p-3";
const pill = "inline-flex items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 text-[13px] font-semibold hover:bg-stone active:scale-95 transition";

/** One resolved scan result with the actions that make sense for it. */
export function MatchCard({ match, h, choosing }: { match: ResolveMatch; h: MatchHandlers; choosing?: boolean }) {
  if (match.type === "item") {
    const it = match.item;
    return (
      <div className={cn(card, "cursor-pointer hover:border-ink/30")} onClick={() => (choosing && h.onChoose ? h.onChoose(it) : h.onOpenItem(it))}>
        <ItemThumb imageId={it.imageIds[0]} category={it.category} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{it.name}</span>
            {match.via === "barcode" && <Barcode className="size-3.5 shrink-0 text-ink-muted" aria-label="matched by product barcode" />}
          </div>
          <PlacePath path={it.locationPath} compact className="mt-0.5" />
          <div className="mt-1">
            <CodeChip code={it.codeDisplay} muted />
          </div>
        </div>
        {choosing ? (
          <span className={pill}>Choose</span>
        ) : h.onDelta ? (
          <QtyStepper quantity={it.quantity} unit={it.unit} low={it.low} onDelta={(d) => h.onDelta!(it, d)} />
        ) : null}
      </div>
    );
  }

  if (match.type === "location") {
    const p = match.location;
    const Icon = kindOf(p.kind).icon;
    return (
      <div className={cn(card, "flex-wrap")}>
        <div className="grid size-14 shrink-0 place-items-center rounded-[10px] border border-outline bg-stone">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{p.name}</div>
          <PlacePath path={p.path.slice(0, -1)} compact className="mt-0.5" />
          <div className="mt-1 text-xs text-ink-muted">
            {p.totalItemCount} item{p.totalItemCount === 1 ? "" : "s"}
            {p.childCount ? ` · ${p.childCount} inside` : ""}
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {h.onPutAwayInto && (
            <button className={pill} onClick={() => h.onPutAwayInto!(p)}>
              <Waypoints className="size-3.5" /> Put away here
            </button>
          )}
          <button className={cn(pill, "bg-ink text-paper hover:bg-ink/90")} onClick={() => h.onOpenPlace(p)}>
            Open <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(card, "flex-wrap border-dashed")}>
      <div className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-emerald-500/10 text-emerald-600">
        <Sparkles className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Unused label</div>
        <div className="mt-0.5 font-mono text-sm tracking-wider">{match.display}</div>
        <div className="text-xs text-ink-muted">{match.inPool ? "From your printed batch — ready to assign." : "Valid code, not from a batch."}</div>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button className={cn(pill, "bg-ink text-paper hover:bg-ink/90")} onClick={() => h.onNewItem({ code: match.code })}>
          <PackagePlus className="size-3.5" /> New item
        </button>
        <button className={pill} onClick={() => h.onNewPlace({ code: match.code })}>
          <QrCode className="size-3.5" /> New box / place
        </button>
      </div>
    </div>
  );
}

/** Nothing matched a manufacturer barcode / random QR. */
export function NoMatchCard({ raw, onNewItem, onSearch }: { raw: string; onNewItem: () => void; onSearch: () => void }) {
  return (
    <div className={cn(card, "flex-wrap border-dashed")}>
      <div className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-amber-500/10 text-amber-600">
        <Barcode className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Not in your inventory</div>
        <div className="truncate font-mono text-xs text-ink-muted" title={raw}>
          {displayCode(raw)}
        </div>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button className={cn(pill, "bg-ink text-paper hover:bg-ink/90")} onClick={onNewItem}>
          <PackagePlus className="size-3.5" /> Add with this barcode
        </button>
        <button className={pill} onClick={onSearch}>
          Search
        </button>
      </div>
    </div>
  );
}
