import { Dialog, DialogContent, DialogDescription, DialogTitle, cn } from "@twodb/blocks";
import { Barcode, Copy, ExternalLink, FileText, History, MapPin, MoveRight, Pencil, Printer, QrCode, ScanLine, Sparkles, Star, Tag, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import { categoryOf } from "../lib/catalog";
import { formatMoney, formatQty, timeAgo } from "../lib/format";
import { Link } from "../lib/router";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { ActivityList } from "../ui/ActivityList";
import { PlacePath } from "../ui/PlacePath";
import { Page, PageHeader, Section, Spinner, btn } from "../ui/Page";
import { QrSvg } from "../ui/QrSvg";
import { QtyStepper } from "../ui/QtyStepper";
import { useItemDetail } from "./hooks/useItemDetail";

export function ItemDetail({ id }: { id: string }) {
  const h = useItemDetail(id);
  const it = h.item;
  if (h.notFound) return <Page><PageHeader title="Item not found" subtitle="It may have been deleted." onBack="/items" /></Page>;
  if (h.loading || !it) return <Spinner />;
  const cat = categoryOf(it.category);
  const Icon = cat.icon;
  const specs = Object.entries(it.specs);
  const stockPct = it.minQuantity ? Math.min(100, (it.quantity / (it.minQuantity * 2)) * 100) : null;

  return (
    <Page>
      <PageHeader
        onBack="/items"
        eyebrow={
          <Link to={`/items?category=${cat.id}`} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in oklab, ${cat.color} 14%, transparent)`, color: cat.color }}>
            <Icon className="size-3.5" /> {cat.label}
          </Link>
        }
        title={
          <span className="inline-flex items-center gap-2">
            {it.name}
            <button aria-label="Star" onClick={h.toggleFavorite} className={cn("rounded-full p-1 transition hover:bg-stone", it.favorite ? "text-amber-500" : "text-ink-muted/50")}>
              <Star className="size-5" fill={it.favorite ? "currentColor" : "none"} />
            </button>
          </span>
        }
        subtitle={it.description || undefined}
        actions={
          <>
            <button className={btn.secondary} onClick={h.duplicate} title="Add a similar item in the same place">
              <Copy className="size-4" /> <span className="hidden sm:inline">Similar</span>
            </button>
            <button className={btn.primary} onClick={h.edit}>
              <Pencil className="size-4" /> Edit
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* gallery */}
          <div className="overflow-hidden rounded-[18px] border border-outline bg-card">
            <div className="relative aspect-[16/10] w-full" style={{ background: `color-mix(in oklab, ${cat.color} 9%, var(--card))` }}>
              {it.imageIds.length ? (
                <img src={api.imageUrl(it.imageIds[Math.min(h.photo, it.imageIds.length - 1)])} alt={it.name} className="size-full object-contain" />
              ) : (
                <button onClick={h.edit} className="grid size-full place-items-center" style={{ color: cat.color }}>
                  <div className="flex flex-col items-center gap-2">
                    <Icon className="size-20 opacity-60" strokeWidth={1.25} />
                    <span className="text-xs font-medium text-ink-muted">Add a photo</span>
                  </div>
                </button>
              )}
              {it.low && (
                <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground shadow">
                  <TriangleAlert className="size-3.5" /> Low stock
                </span>
              )}
            </div>
            {it.imageIds.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-2">
                {it.imageIds.map((img, i) => (
                  <button key={img} onClick={() => h.setPhoto(i)} className={cn("size-16 shrink-0 overflow-hidden rounded-lg border-2", i === h.photo ? "border-ink" : "border-transparent opacity-70")}>
                    <img src={api.imageUrl(img)} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {specs.length > 0 && (
            <Section title="Specs">
              <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-outline sm:grid-cols-2">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b border-outline px-3 py-2.5 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:border-r">
                    <dt className="w-28 shrink-0 text-xs font-semibold text-ink-muted uppercase">{k}</dt>
                    <dd className="min-w-0 text-sm font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {(it.tags.length > 0 || it.barcodes.length > 0) && (
            <Section title="Tags & barcodes">
              <div className="flex flex-wrap gap-1.5">
                {it.tags.map((t) => (
                  <Link key={t} to={`/items?tag=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 rounded-full border border-outline bg-paper px-2.5 py-1 text-xs font-medium hover:border-ink/30">
                    <Tag className="size-3" /> {t}
                  </Link>
                ))}
                {it.barcodes.map((b) => (
                  <span key={b} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-outline bg-paper px-2 py-1 font-mono text-xs" title={b}>
                    <Barcode className="size-3.5 shrink-0" /> <span className="truncate">{b}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {(it.manufacturer || it.mpn || it.supplier || it.unitCost !== null || it.purchaseUrl || it.datasheetUrl || it.notes) && (
            <Section title="Details">
              <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {it.manufacturer && <Kv k="Manufacturer" v={it.manufacturer} />}
                {it.mpn && <Kv k="Part number" v={<span className="font-mono">{it.mpn}</span>} />}
                {it.supplier && <Kv k="Supplier" v={it.supplier} />}
                {it.unitCost !== null && <Kv k="Unit cost" v={`${formatMoney(it.unitCost)} · total ${formatMoney(it.unitCost * it.quantity)}`} />}
              </div>
              {(it.purchaseUrl || it.datasheetUrl) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {it.purchaseUrl && (
                    <a href={it.purchaseUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
                      <ExternalLink className="size-4" /> Buy again
                    </a>
                  )}
                  {it.datasheetUrl && (
                    <a href={it.datasheetUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
                      <FileText className="size-4" /> Datasheet
                    </a>
                  )}
                </div>
              )}
              {it.notes && <p className="mt-4 rounded-xl bg-paper p-3 text-sm whitespace-pre-wrap">{it.notes}</p>}
            </Section>
          )}

          <Section title={<span className="inline-flex items-center gap-1.5"><History className="size-3.5" /> History</span>}>
            <ActivityList entries={h.activity} />
          </Section>
        </div>

        {/* side column: the physical facts */}
        <div className="space-y-4">
          <Section title="Stock">
            <div className="flex items-center justify-between gap-3">
              <QtyStepper quantity={it.quantity} unit={it.unit} low={it.low} onDelta={h.delta} size="lg" />
              <div className="flex flex-col gap-1.5">
                <button className={cn(btn.secondary, "px-3 py-1.5 text-xs")} onClick={() => h.delta(10)}>
                  +10
                </button>
                <button className={cn(btn.ghost, "px-3 py-1.5 text-xs")} onClick={() => h.setSetQtyOpen(true)}>
                  Set…
                </button>
              </div>
            </div>
            {stockPct !== null && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-stone">
                  <div className={cn("h-full rounded-full transition-all", it.low ? "bg-destructive" : "bg-emerald-500")} style={{ width: `${Math.max(3, stockPct)}%` }} />
                </div>
                <div className="mt-1.5 text-xs text-ink-muted">
                  Alert at {formatQty(it.minQuantity!)} {it.unit}
                </div>
              </div>
            )}
          </Section>

          <Section
            title={<span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> Location</span>}
            action={
              <div className="flex gap-1">
                <button className={cn(btn.ghost, "px-2 py-1 text-xs")} onClick={() => void h.scanMove()}>
                  <ScanLine className="size-3.5" /> Scan box
                </button>
                <button className={cn(btn.ghost, "px-2 py-1 text-xs")} onClick={() => h.setMoveOpen(true)}>
                  <MoveRight className="size-3.5" /> Move
                </button>
              </div>
            }
          >
            <PlacePath path={it.locationPath} className="text-sm" />
          </Section>

          <Section
            title={<span className="inline-flex items-center gap-1.5"><QrCode className="size-3.5" /> Label</span>}
            action={
              it.code ? (
                <button className={cn(btn.ghost, "px-2 py-1 text-xs")} onClick={h.print}>
                  <Printer className="size-3.5" /> Print
                </button>
              ) : undefined
            }
          >
            {it.code ? (
              <div className="flex items-center gap-4">
                <QrSvg text={it.code} className="size-24 rounded-lg border border-outline" />
                <div>
                  <div className="font-mono text-2xl font-bold tracking-[0.15em]">{it.codeDisplay}</div>
                  <button className="mt-1 text-xs text-ink-muted hover:text-ink hover:underline" onClick={() => void h.assignLabel()}>
                    Replace label…
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ink-muted">No label yet.</p>
                <div className="flex flex-wrap gap-2">
                  <button className={btn.primary} onClick={() => void h.assignLabel()}>
                    <ScanLine className="size-4" /> Scan a sticker
                  </button>
                  <button className={btn.secondary} onClick={h.autoLabel}>
                    <Sparkles className="size-4" /> Generate
                  </button>
                </div>
              </div>
            )}
          </Section>

          <div className="px-1 text-xs text-ink-muted">
            Added {timeAgo(it.createdAt)} · updated {timeAgo(it.updatedAt)}
          </div>
        </div>
      </div>

      <PlacePickerDialog open={h.moveOpen} onOpenChange={h.setMoveOpen} selectedId={it.locationId} onPick={h.moveTo} title={`Move “${it.name}” to…`} />
      <Dialog open={h.setQtyOpen} onOpenChange={h.setSetQtyOpen}>
        <DialogContent className="max-w-xs">
          <DialogTitle>Set exact quantity</DialogTitle>
          <DialogDescription>After a stock count.</DialogDescription>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(new FormData(e.currentTarget).get("q"));
              if (Number.isFinite(v) && v >= 0) h.setExact(v);
            }}
          >
            <input name="q" autoFocus inputMode="decimal" defaultValue={it.quantity} className="h-10 min-w-0 flex-1 rounded-xl border border-outline bg-paper px-3 text-lg font-semibold tabular-nums outline-none" />
            <button className={btn.primary}>Set</button>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-muted uppercase">{k}</div>
      <div className="mt-0.5 font-medium">{v}</div>
    </div>
  );
}
