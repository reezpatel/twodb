import { cn } from "@twodb/blocks";
import { Barcode, ChevronDown, Image, Info, MapPin, QrCode, ShoppingCart, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import { ALL_UNITS, categoryOf } from "../lib/catalog";
import { back } from "../lib/router";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { Card, Field, inputCls, textareaCls } from "../ui/Field";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";
import { useItemEditor } from "./hooks/useItemEditor";
import { BarcodeField } from "./partials/BarcodeField";
import { CategoryPicker } from "./partials/CategoryPicker";
import { LabelField } from "./partials/LabelField";
import { PhotoStrip } from "./partials/PhotoStrip";
import { PlaceField } from "./partials/PlaceField";
import { SpecsEditor } from "./partials/SpecsEditor";
import { TagInput } from "./partials/TagInput";

export function ItemEditor({ id }: { id?: string }) {
  const h = useItemEditor(id);
  const d = h.draft;
  if (h.notFound) return <Page><PageHeader title="Item not found" onBack="/items" /></Page>;
  if (!h.loaded) return <Spinner />;
  const cat = categoryOf(d.category);

  return (
    <Page>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void h.save(false);
        }}
      >
        <PageHeader
          onBack="/items"
          title={h.isEdit ? `Edit ${d.name || "item"}` : "Add item"}
          subtitle={h.isEdit ? undefined : "Stick a label on it, scan, fill what you know — everything except the name is optional."}
          actions={
            <button type="button" onClick={() => h.set("favorite", !d.favorite)} className={cn(btn.secondary, d.favorite && "border-amber-500 text-amber-600")}>
              <Star className="size-4" fill={d.favorite ? "currentColor" : "none"} /> {d.favorite ? "Starred" : "Star"}
            </button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* ------------------------------------------------ main column */}
          <div className="space-y-4">
            <Card>
              <Field label="Name">
                <input ref={h.nameRef} autoFocus={!h.isEdit} value={d.name} onChange={(e) => h.set("name", e.target.value)} placeholder={`e.g. ${cat.example}`} className={cn(inputCls, "h-12 text-lg font-semibold")} />
              </Field>
              <Field label="Category">
                <CategoryPicker value={d.category} onChange={h.setCategory} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Quantity">
                  <input inputMode="decimal" value={d.quantity} onChange={(e) => h.set("quantity", e.target.value)} className={cn(inputCls, "font-semibold tabular-nums")} />
                </Field>
                <Field label="Unit">
                  <input list="tt-units" value={d.unit} onChange={(e) => h.set("unit", e.target.value)} className={inputCls} />
                  <datalist id="tt-units">
                    {[...new Set([...cat.units, ...ALL_UNITS])].map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Alert below" hint="Low-stock threshold">
                  <input inputMode="decimal" value={d.minQuantity} onChange={(e) => h.set("minQuantity", e.target.value)} placeholder="—" className={cn(inputCls, "tabular-nums")} />
                </Field>
              </div>
            </Card>

            <Card title="Specs" icon={<SlidersHorizontal className="size-3.5" />}>
              <SpecsEditor rows={d.specs} onChange={h.setSpec} onAdd={h.addSpec} onRemove={h.removeSpec} />
              <Field label="Tags">
                <TagInput tags={d.tags} input={h.tagInput} onInput={h.setTagInput} onAdd={h.addTag} onRemove={h.removeTag} suggestions={h.tagSuggestions} />
              </Field>
            </Card>

            <Card title="Notes" icon={<Info className="size-3.5" />}>
              <textarea rows={2} value={d.description} onChange={(e) => h.set("description", e.target.value)} placeholder="Short description" className={textareaCls} />
              <textarea rows={3} value={d.notes} onChange={(e) => h.set("notes", e.target.value)} placeholder="Notes — pinout quirks, which project it's for, who borrowed it…" className={textareaCls} />
            </Card>

            <div className="rounded-[18px] border border-outline bg-card">
              <button type="button" onClick={() => h.setMoreOpen(!h.moreOpen)} className="flex w-full items-center gap-2 p-4 text-[13px] font-semibold tracking-wider text-ink-muted uppercase md:px-5">
                <ShoppingCart className="size-3.5" /> Sourcing & links
                <ChevronDown className={cn("ml-auto size-4 transition", h.moreOpen && "rotate-180")} />
              </button>
              {h.moreOpen && (
                <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 md:px-5 md:pb-5">
                  <Field label="Manufacturer">
                    <input value={d.manufacturer} onChange={(e) => h.set("manufacturer", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Part number / model">
                    <input value={d.mpn} onChange={(e) => h.set("mpn", e.target.value)} className={cn(inputCls, "font-mono")} />
                  </Field>
                  <Field label="Supplier">
                    <input value={d.supplier} onChange={(e) => h.set("supplier", e.target.value)} placeholder="AliExpress, Digikey, local store…" className={inputCls} />
                  </Field>
                  <Field label="Unit cost">
                    <input inputMode="decimal" value={d.unitCost} onChange={(e) => h.set("unitCost", e.target.value)} placeholder="0.00" className={inputCls} />
                  </Field>
                  <Field label="Buy again link">
                    <input type="url" value={d.purchaseUrl} onChange={(e) => h.set("purchaseUrl", e.target.value)} placeholder="https://" className={inputCls} />
                  </Field>
                  <Field label="Datasheet / manual">
                    <input type="url" value={d.datasheetUrl} onChange={(e) => h.set("datasheetUrl", e.target.value)} placeholder="https://" className={inputCls} />
                  </Field>
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------- physical column */}
          <div className="space-y-4">
            <Card title="Label" icon={<QrCode className="size-3.5" />}>
              <LabelField code={d.code} status={h.labelStatus} autoCode={d.autoCode} onChange={(v) => h.set("code", v)} onScan={() => void h.scanLabel()} onAuto={(on) => h.set("autoCode", on)} />
            </Card>
            <Card title="Location" icon={<MapPin className="size-3.5" />}>
              <PlaceField place={h.place} onOpen={() => h.setPlaceOpen(true)} onScan={() => void h.scanPlace()} onClear={() => h.set("locationId", null)} />
            </Card>
            <Card title="Product barcode / QR" icon={<Barcode className="size-3.5" />}>
              <BarcodeField barcodes={d.barcodes} onAdd={(b) => h.addBarcode(b)} onRemove={h.removeBarcode} onScan={() => void h.scanBarcode()} />
              <div className="text-xs text-ink-muted">Scanning this later (in any scan mode) finds the item — no label needed.</div>
            </Card>
            <Card title="Photos" icon={<Image className="size-3.5" />}>
              <PhotoStrip imageIds={d.imageIds} uploading={h.uploading} onAdd={(f) => void h.addPhotos(f)} onRemove={h.removePhoto} onCover={h.makeCover} />
            </Card>
            {h.isEdit && (
              <button type="button" onClick={() => void h.remove()} className={cn(btn.danger, "w-full")}>
                <Trash2 className="size-4" /> Delete item
              </button>
            )}
          </div>
        </div>

        {/* sticky action bar */}
        <div className="sticky bottom-20 z-20 mt-6 md:bottom-4">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-outline bg-paper/90 p-2 shadow-xl backdrop-blur">
            {h.error ? <span className="px-3 text-sm font-medium text-destructive">{h.error}</span> : <span className="hidden px-3 text-xs text-ink-muted sm:inline">⏎ to save</span>}
            <div className="ml-auto flex gap-2">
              <button type="button" className={btn.ghost} onClick={() => back("/items")}>
                Cancel
              </button>
              {!h.isEdit && (
                <button type="button" disabled={h.saving || h.uploading > 0} onClick={() => void h.save(true)} className={btn.secondary}>
                  Save & add another
                </button>
              )}
              <button type="submit" disabled={h.saving || h.uploading > 0} className={btn.primary}>
                {h.saving ? "Saving…" : h.isEdit ? "Save" : "Add item"}
              </button>
            </div>
          </div>
        </div>
      </form>
      <PlacePickerDialog
        open={h.placeOpen}
        onOpenChange={h.setPlaceOpen}
        selectedId={d.locationId}
        onPick={(p) => {
          h.set("locationId", p?.id ?? null);
          h.setPlaceOpen(false);
        }}
      />
    </Page>
  );
}
