import { useState } from "react";
import { ChevronRight, Copy, ExternalLink, Loader2, MapPin, Pencil, Printer, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mediaUrl } from "@/components/ui/property-cell/media-cell";
import { cn } from "@/lib/utils";
import { formatDate, formatQuantity, type InventoryItem, type LogEntry } from "./inventory-api";
import { LocationSelect } from "./location-select";
import { useItemDetail, type AdjustMode } from "./use-item-detail";

interface ItemDetailProps {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onPrintLabel: (item: InventoryItem) => void;
}

const MODES: { id: AdjustMode; label: string }[] = [
  { id: "add", label: "Add" },
  { id: "remove", label: "Remove" },
  { id: "set", label: "Set to" },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 text-right break-words">{children}</span>
    </div>
  );
}

function HistoryRow({ entry }: { entry: LogEntry }) {
  return (
    <li className="flex flex-col gap-0.5 border-l pl-3 text-xs">
      <span className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] capitalize">
          {entry.action}
        </Badge>
        <span className="min-w-0 truncate">{entry.title}</span>
      </span>
      <span className="text-muted-foreground">
        {entry.at ? new Date(entry.at).toLocaleString() : ""}
        {entry.actor ? ` · ${entry.actor}` : ""}
        {entry.reason ? ` · ${entry.reason}` : ""}
      </span>
    </li>
  );
}

export function ItemDetail({ item, onClose, onEdit, onPrintLabel }: ItemDetailProps) {
  const d = useItemDetail(item);
  const [photo, setPhoto] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const code = item?.code ? `${item.code.slice(0, 4)}-${item.code.slice(4)}` : null;
  const cover = item?.images[Math.min(photo, Math.max((item?.images.length ?? 1) - 1, 0))];

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {item ? (
          <>
            <SheetHeader className="pb-2">
              <SheetTitle className="pr-8 text-xl">{item.title || "Untitled"}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                {code ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono text-xs"
                    onClick={() => void navigator.clipboard?.writeText(item.code!)}
                    title="Copy barcode"
                  >
                    {code} <Copy size={11} />
                  </button>
                ) : null}
                {item.groups.map((g) => (
                  <Badge key={g} variant="secondary">
                    {g}
                  </Badge>
                ))}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-6">
              {item.images.length > 0 ? (
                <div className="space-y-2">
                  <img src={mediaUrl(cover!)} alt="" className="bg-muted max-h-72 w-full rounded-lg border object-contain" />
                  {item.images.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto">
                      {item.images.map((id, i) => (
                        <button key={id} type="button" onClick={() => setPhoto(i)} className={cn("size-14 shrink-0 overflow-hidden rounded-md border", i === photo && "ring-ring ring-2")}>
                          <img src={mediaUrl(id)} alt="" className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Stock</h3>
                  <Badge variant={item.lowStock ? "destructive" : "secondary"} className="text-sm tabular-nums">
                    {formatQuantity(item)}
                  </Badge>
                </div>
                {item.minQuantity !== null ? <p className="text-muted-foreground text-xs">Reorder at {item.minQuantity}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex overflow-hidden rounded-md border text-xs">
                    {MODES.map((m) => (
                      <button key={m.id} type="button" onClick={() => d.setMode(m.id)} className={cn("px-2.5 py-1.5", d.mode === m.id ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <Input className="h-8 w-24" type="number" min={0} step="any" placeholder="Amount" value={d.amount} onChange={(e) => d.setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && d.applyAdjust()} />
                  <Input className="h-8 min-w-24 flex-1" placeholder="Reason (optional)" value={d.reason} onChange={(e) => d.setReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && d.applyAdjust()} />
                  <Button size="sm" disabled={d.adjusting} onClick={d.applyAdjust}>
                    {d.adjusting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Apply
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Locate</h3>
                {d.breadcrumb.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    <MapPin size={14} className="text-muted-foreground" />
                    {d.breadcrumb.map((c, i) => (
                      <span key={c.id} className="flex items-center gap-1">
                        {i > 0 ? <ChevronRight size={12} className="text-muted-foreground" /> : null}
                        <button type="button" className="hover:underline" onClick={() => d.goToLocation(c.id)}>
                          {c.title || "Untitled"}
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No location set</p>
                )}
                {d.breadcrumb.length > 0 ? (
                  <button type="button" className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline" onClick={() => d.goToLocation(d.breadcrumb.at(-1)!.id)}>
                    See everything stored there
                  </button>
                ) : null}
                <div className="flex gap-2">
                  <LocationSelect className="h-8 flex-1" locations={d.locations} value={d.moveTo ?? item.locationId ?? ""} onChange={d.setMoveTo} />
                  <Button size="sm" variant="outline" disabled={d.moveTo === null || d.moving} onClick={d.applyMove}>
                    Move
                  </Button>
                </div>
              </section>

              {d.error ? <p className="text-destructive text-sm">{d.error}</p> : null}

              <section className="space-y-1.5">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Details</h3>
                {item.description ? <p className="text-sm whitespace-pre-wrap">{item.description}</p> : null}
                <Row label="SKU">{item.sku}</Row>
                <Row label="Manufacturer barcode">{item.extBarcode}</Row>
                <Row label="Supplier">{item.supplier}</Row>
                <Row label="Unit cost">{item.unitCost !== null ? item.unitCost.toFixed(2) : null}</Row>
                <Row label="Stock value">{item.unitCost !== null ? (item.unitCost * item.quantity).toFixed(2) : null}</Row>
                <Row label="Purchased">{item.purchasedAt ? formatDate(item.purchasedAt) : null}</Row>
                <Row label="Expiry / warranty">{item.expiresAt ? formatDate(item.expiresAt) : null}</Row>
                {item.productUrl ? (
                  <a href={item.productUrl} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 text-sm hover:underline">
                    <ExternalLink size={12} /> {item.productUrl}
                  </a>
                ) : null}
              </section>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                  <Pencil /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPrintLabel(item)}>
                  <Printer /> Print label
                </Button>
                {confirmDelete ? (
                  <Button size="sm" variant="destructive" disabled={d.inv.deleteItem.isPending} onClick={() => d.inv.deleteItem.mutate(item.id)}>
                    Confirm delete
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>

              <section className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">History</h3>
                {d.log.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                <ul className="space-y-3">
                  {(d.log.data?.entries ?? []).map((e) => (
                    <HistoryRow key={e.id} entry={e} />
                  ))}
                </ul>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
