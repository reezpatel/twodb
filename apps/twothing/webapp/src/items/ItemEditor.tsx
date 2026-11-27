import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@twodb/blocks";
import { Camera, ChevronDown, ChevronsUpDown, CircleCheck, CircleX, Loader2, MapPinOff, Plus, ScanBarcode, ScanLine, Star, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { ALL_UNITS, CATEGORIES, categoryOf, kindOf } from "../lib/catalog";
import { back } from "../lib/router";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { Group, Row, control } from "../ui/FormKit";
import { Page, PageHeader, Spinner, cbtn } from "../ui/Page";
import { Switch } from "../ui/Switch";
import { useItemEditor } from "./hooks/useItemEditor";

export function ItemEditor({ id, sheet = false }: { id?: string; sheet?: boolean }) {
  const h = useItemEditor(id);
  const d = h.draft;
  if (h.notFound)
    return (
      <Page>
        <PageHeader title="Item not found" onBack="/items" />
      </Page>
    );
  if (!h.loaded) return <Spinner />;

  const cat = categoryOf(d.category);
  const CatIcon = cat.icon;
  const PlaceIcon = h.place ? kindOf(h.place.kind).icon : MapPinOff;
  const st = h.labelStatus;
  const units = [...new Set([...cat.units, ...ALL_UNITS])];

  const starBtn = (
    <button type="button" onClick={() => h.set("favorite", !d.favorite)} className={cn(cbtn.secondary, d.favorite && "border-amber-500 text-amber-600")}>
      <Star className="size-3.5" fill={d.favorite ? "currentColor" : "none"} /> {d.favorite ? "Starred" : "Star"}
    </button>
  );
  const fields = (
    <>
      {/* photos: tiles, first is the cover */}
      <div className="flex flex-wrap gap-3">
        {d.imageIds.map((imgId, i) => (
          <div key={imgId} className="group relative size-32 overflow-hidden rounded-[6px] border border-outline bg-stone">
            <img src={api.imageUrl(imgId)} alt="" className="size-full object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-[4px] bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">Cover</span>
            ) : (
              <button
                type="button"
                title="Make cover"
                onClick={() => h.makeCover(imgId)}
                className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-[6px] bg-paper/90 opacity-0 transition group-hover:opacity-100"
              >
                <Star className="size-3" />
              </button>
            )}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => h.removePhoto(imgId)}
              className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-[6px] bg-paper/90 text-ink-muted transition hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: h.uploading }).map((_, i) => (
          <div key={`u${i}`} className="grid size-32 place-items-center rounded-[6px] border border-dashed border-outline">
            <Loader2 className="size-5 animate-spin text-ink-muted" />
          </div>
        ))}
        <label className="flex size-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-ink/25 text-[12px] text-ink-muted transition hover:border-ink/50 hover:bg-stone hover:text-ink">
          <Camera className="size-5" strokeWidth={1.5} />
          Add photo
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && void h.addPhotos(e.target.files)} />
        </label>
      </div>

      <Group title="Details">
        <Row label="Name">
          <input
            ref={h.nameRef}
            autoFocus={!h.isEdit}
            value={d.name}
            onChange={(e) => h.set("name", e.target.value)}
            placeholder={`e.g. ${cat.example}`}
            className={control}
          />
        </Row>
        <Row label="Category">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(control, "flex items-center gap-2 text-left")}>
                <CatIcon className="size-3.5 shrink-0" style={{ color: cat.color }} />
                <span className="flex-1 truncate">{cat.label}</span>
                <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuRadioGroup value={d.category} onValueChange={h.setCategory}>
                {CATEGORIES.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={c.id}>
                    <c.icon className="size-3.5" style={{ color: c.color }} /> {c.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Row>
        <Row label="Description">
          <textarea
            rows={2}
            value={d.description}
            onChange={(e) => h.set("description", e.target.value)}
            placeholder="Short description"
            className={cn(control, "h-auto py-1.5")}
          />
        </Row>
      </Group>

      <Group title="Stock">
        <Row label="Quantity">
          <input inputMode="decimal" value={d.quantity} onChange={(e) => h.set("quantity", e.target.value)} className={cn(control, "tabular-nums")} />
        </Row>
        <Row label="Unit">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(control, "flex items-center gap-2 text-left")}>
                <span className="flex-1 truncate">{d.unit || "Choose unit"}</span>
                <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuRadioGroup value={d.unit} onValueChange={(v) => h.set("unit", v)}>
                {units.map((u) => (
                  <DropdownMenuRadioItem key={u} value={u}>
                    {u}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Row>
        <Row label="Alert below" hint="Low-stock threshold">
          <input
            inputMode="decimal"
            value={d.minQuantity}
            onChange={(e) => h.set("minQuantity", e.target.value)}
            placeholder="—"
            className={cn(control, "tabular-nums")}
          />
        </Row>
      </Group>

      <Group title="Location">
        <Row label="Stored in" hint="Where it lives">
          <div className="flex gap-2">
            <button type="button" onClick={() => h.setPlaceOpen(true)} className={cn(control, "flex min-w-0 flex-1 items-center gap-2 text-left")}>
              <PlaceIcon className="size-3.5 shrink-0 text-ink-muted" />
              {h.place ? (
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-ink-muted">{h.place.path.slice(0, -1).map((c) => c.name + " › ")}</span>
                  {h.place.name}
                </span>
              ) : (
                <span className="flex-1 text-ink-muted">Unplaced</span>
              )}
              {h.place ? (
                <X
                  className="size-3.5 shrink-0 text-ink-muted hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation();
                    h.set("locationId", null);
                  }}
                />
              ) : (
                <ChevronsUpDown className="size-3.5 shrink-0 text-ink-muted" />
              )}
            </button>
            <button type="button" onClick={() => void h.scanPlace()} title="Scan the box label" className={cbtn.secondary}>
              <ScanLine className="size-3.5" /> Scan
            </button>
          </div>
        </Row>
      </Group>

      <Group title="Label">
        <Row label="Generate label" hint="Create a new code on save">
          <div className="flex h-8 items-center justify-end">
            <Switch label="Generate label" checked={d.autoCode} onChange={(v) => h.set("autoCode", v)} />
          </div>
        </Row>
        <Row label="Code" hint={d.autoCode ? "Generated on save" : "Scan a printed sticker or type one"}>
          <div className="flex gap-2">
            <input
              value={d.code}
              onChange={(e) => h.set("code", e.target.value)}
              placeholder={d.autoCode ? "Generated on save" : "e.g. K7Q-M2X"}
              disabled={d.autoCode}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                control,
                "flex-1 font-mono tracking-[0.12em] uppercase disabled:opacity-50 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case",
                st.state === "taken" && "border-destructive",
                (st.state === "free" || st.state === "mine") && "border-emerald-500/60",
              )}
            />
            <button type="button" disabled={d.autoCode} onClick={() => void h.scanLabel()} className={cbtn.secondary}>
              <ScanLine className="size-3.5" /> Scan
            </button>
          </div>
          <div className="flex min-h-4 flex-wrap items-center gap-x-3 text-[12px]" hidden={d.autoCode}>
            {st.state === "checking" && (
              <span className="inline-flex items-center gap-1 text-ink-muted">
                <Loader2 className="size-3 animate-spin" /> Checking…
              </span>
            )}
            {st.state === "free" && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CircleCheck className="size-3.5" /> Free label{st.inPool ? " from your printed batch" : ""}
              </span>
            )}
            {st.state === "mine" && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CircleCheck className="size-3.5" /> Current label
              </span>
            )}
            {st.state === "taken" && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <CircleX className="size-3.5" /> Already on {st.by}
              </span>
            )}
            {st.state === "custom" && <span className="text-ink-muted">Custom code (not a TwoThing label format)</span>}
          </div>
        </Row>
        <Row label="Product barcode" hint="Scanning it later finds the item">
          <div className="flex flex-wrap gap-1.5 empty:hidden">
            {d.barcodes.map((b) => (
              <span key={b} className="inline-flex max-w-full items-center gap-1.5 rounded-[6px] border border-ink/20 py-0.5 pr-1 pl-2 font-mono text-[11px]">
                <span className="truncate" title={b}>
                  {b}
                </span>
                <button type="button" aria-label="Remove barcode" onClick={() => h.removeBarcode(b)} className="rounded p-0.5 text-ink-muted hover:text-ink">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Type or scan EAN / UPC / QR, Enter to add"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  h.addBarcode(e.currentTarget.value);
                  e.currentTarget.value = "";
                }
              }}
              className={cn(control, "flex-1 font-mono placeholder:font-sans")}
            />
            <button type="button" onClick={() => void h.scanBarcode()} className={cbtn.secondary}>
              <ScanBarcode className="size-3.5" /> Scan
            </button>
          </div>
        </Row>
      </Group>

      <Group title="Specs & tags">
        <Row label="Specs">
          <div className="space-y-1.5">
            {d.specs.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={r.key}
                  onChange={(e) => h.setSpec(i, { ...r, key: e.target.value })}
                  placeholder="Property"
                  className={cn(control, "w-2/5 font-medium")}
                />
                <input value={r.value} onChange={(e) => h.setSpec(i, { ...r, value: e.target.value })} placeholder="—" className={cn(control, "flex-1")} />
                <button
                  type="button"
                  aria-label="Remove row"
                  onClick={() => h.removeSpec(i)}
                  className="grid size-8 shrink-0 place-items-center rounded-[6px] text-ink-muted hover:bg-stone hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={h.addSpec} className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink">
              <Plus className="size-3.5" /> Add property
            </button>
          </div>
        </Row>
        <Row label="Tags">
          <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-[6px] border border-ink/20 px-2 py-1 focus-within:border-ink/50">
            {d.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-[4px] bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => h.removeTag(t)} className="opacity-60 hover:opacity-100">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={h.tagInput}
              onChange={(e) => (e.target.value.endsWith(",") ? h.addTag(e.target.value) : h.setTagInput(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  h.addTag(h.tagInput);
                } else if (e.key === "Backspace" && !h.tagInput && d.tags.length) h.removeTag(d.tags[d.tags.length - 1]);
              }}
              placeholder={d.tags.length ? "" : "Add tags…"}
              className="h-6 min-w-24 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-ink-muted"
            />
          </div>
          {h.tagSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {h.tagSuggestions.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => h.addTag(s)}
                  className="inline-flex items-center gap-0.5 rounded-[4px] border border-dashed border-ink/25 px-1.5 py-0.5 text-[11px] text-ink-muted hover:border-ink/50 hover:text-ink"
                >
                  <Plus className="size-3" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </Row>
      </Group>

      <Group title="Notes">
        <Row label="Notes">
          <textarea
            rows={3}
            value={d.notes}
            onChange={(e) => h.set("notes", e.target.value)}
            placeholder="Pinout quirks, which project it's for, who borrowed it…"
            className={cn(control, "h-auto py-1.5")}
          />
        </Row>
      </Group>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => h.setMoreOpen(!h.moreOpen)}
          className="flex w-full items-center gap-2 px-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase hover:text-ink"
        >
          Sourcing & links
          <ChevronDown className={cn("ml-auto size-3.5 transition", h.moreOpen && "rotate-180")} />
        </button>
        {h.moreOpen && (
          <Group>
            <Row label="Manufacturer">
              <input value={d.manufacturer} onChange={(e) => h.set("manufacturer", e.target.value)} className={control} />
            </Row>
            <Row label="Part number">
              <input value={d.mpn} onChange={(e) => h.set("mpn", e.target.value)} className={cn(control, "font-mono")} />
            </Row>
            <Row label="Supplier">
              <input
                value={d.supplier}
                onChange={(e) => h.set("supplier", e.target.value)}
                placeholder="AliExpress, Digikey, local store…"
                className={control}
              />
            </Row>
            <Row label="Unit cost">
              <input
                inputMode="decimal"
                value={d.unitCost}
                onChange={(e) => h.set("unitCost", e.target.value)}
                placeholder="0.00"
                className={cn(control, "tabular-nums")}
              />
            </Row>
            <Row label="Buy again link">
              <input type="url" value={d.purchaseUrl} onChange={(e) => h.set("purchaseUrl", e.target.value)} placeholder="https://" className={control} />
            </Row>
            <Row label="Datasheet / manual">
              <input type="url" value={d.datasheetUrl} onChange={(e) => h.set("datasheetUrl", e.target.value)} placeholder="https://" className={control} />
            </Row>
          </Group>
        )}
      </section>
    </>
  );
  const actions = (
    <>
      {h.isEdit && (
        <button type="button" onClick={() => void h.remove()} className={cn(cbtn.secondary, "border-destructive/40 text-destructive hover:bg-destructive/10")}>
          <Trash2 className="size-3.5" /> Delete
        </button>
      )}
      <div className="ml-auto flex gap-2">
        <button type="button" className={cbtn.secondary} onClick={() => back("/items")}>
          Cancel
        </button>
        {!h.isEdit && (
          <button type="button" disabled={h.saving || h.uploading > 0} onClick={() => void h.save(true)} className={cbtn.secondary}>
            Save & add another
          </button>
        )}
        <button type="submit" disabled={h.saving || h.uploading > 0} className={cbtn.primary}>
          {h.saving ? "Saving…" : h.isEdit ? "Save" : "Add item"}
        </button>
      </div>
    </>
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void h.save(false);
  };

  if (sheet)
    return (
      <>
        {/* swallows outside clicks: the sheet is only closed by Cancel / Save / Esc */}
        <div aria-hidden className="fixed inset-0 z-50 animate-in bg-ink/30 backdrop-blur-[1px] fade-in-0" />
        <Dialog open modal={false} onOpenChange={(o) => !o && back("/items")}>
          <DialogContent
            showClose={false}
            onInteractOutside={(e) => e.preventDefault()}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              h.nameRef.current?.focus();
            }}
            className="inset-y-0 top-0 right-0 left-auto flex h-dvh w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-r-0 border-l border-outline p-0 data-[state=closed]:slide-out-to-right data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-right data-[state=open]:zoom-in-100 data-[state=open]:duration-300"
          >
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
              <div className="flex shrink-0 items-center gap-3 border-b border-outline px-5 py-3">
                <DialogTitle className="flex-1 text-[15px] font-normal">{h.isEdit ? `Edit ${d.name || "item"}` : "Add item"}</DialogTitle>
                <DialogDescription className="sr-only">Fill in what you know — only the name is required.</DialogDescription>
                {starBtn}
              </div>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">{fields}</div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-outline bg-paper px-5 py-3">
                {h.error && <span className="w-full text-[12px] font-medium text-destructive">{h.error}</span>}
                {actions}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );

  return (
    <Page>
      <PageHeader onBack="/items" title={h.isEdit ? `Edit ${d.name || "item"}` : "Add item"} actions={starBtn} />
      <form className="mx-auto max-w-3xl space-y-6" onSubmit={submit}>
        {fields}
        {h.error && <p className="text-[13px] font-medium text-destructive">{h.error}</p>}
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </form>
    </Page>
  );
}
