import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryItem } from "./inventory-api";
import { GroupInput } from "./group-input";
import { ImageField } from "./image-field";
import { LocationSelect } from "./location-select";
import { useItemForm, type ItemFormValues } from "./use-item-form";

type TextKey = "title" | "unit" | "sku" | "extBarcode" | "supplier" | "productUrl";
type NumberKey = "quantity" | "minQuantity" | "unitCost";
type DateKey = "purchasedAt" | "expiresAt";

interface ItemFormDialogProps {
  open: boolean;
  item: InventoryItem | null;
  preset?: Partial<ItemFormValues>;
  onClose: (noteId?: string) => void;
}

export function ItemFormDialog({ open, item, preset = {}, onClose }: ItemFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>
        {open ? <ItemForm item={item} preset={preset} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({ item, preset, onClose }: { item: InventoryItem | null; preset: Partial<ItemFormValues>; onClose: (noteId?: string) => void }) {
  const { form, error, locations, groupNames, upload, newLocation } = useItemForm(item, preset, onClose);

  const text = (name: TextKey, label: string, type = "text", required = false) => (
    <form.Field name={name} validators={required ? { onSubmit: ({ value }) => (value.trim() ? undefined : "Required") } : undefined}>
      {(f) => (
        <div className="space-y-1">
          <Label htmlFor={name}>{label}</Label>
          <Input id={name} type={type} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} aria-invalid={f.state.meta.errors.length > 0} />
          {f.state.meta.errors.length > 0 ? <p className="text-destructive text-xs">{String(f.state.meta.errors[0])}</p> : null}
        </div>
      )}
    </form.Field>
  );

  const number = (name: NumberKey, label: string, step = "any") => (
    <form.Field name={name}>
      {(f) => (
        <div className="space-y-1">
          <Label htmlFor={name}>{label}</Label>
          <Input id={name} type="number" min={0} step={step} inputMode="decimal" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
        </div>
      )}
    </form.Field>
  );

  const date = (name: DateKey, label: string) => (
    <form.Field name={name}>
      {(f) => (
        <div className="space-y-1">
          <Label htmlFor={name}>{label}</Label>
          <Input id={name} type="date" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
        </div>
      )}
    </form.Field>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {text("title", "Title", "text", true)}

      <form.Field name="description">
        {(f) => (
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-3 gap-3">
        {number("quantity", "Quantity")}
        {text("unit", "Unit (pcs, kg…)")}
        {number("minQuantity", "Min stock")}
      </div>

      <form.Field name="locationId">
        {(f) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Location</Label>
              <button
                type="button"
                className="text-primary text-xs hover:underline"
                onClick={() => newLocation((id) => f.handleChange(id))}
              >
                + New location (warehouse, rack, box…)
              </button>
            </div>
            <LocationSelect locations={locations} value={f.state.value} onChange={f.handleChange} />
          </div>
        )}
      </form.Field>

      <form.Field name="groups">
        {(f) => (
          <div className="space-y-1">
            <Label>Groups</Label>
            <GroupInput value={f.state.value} onChange={f.handleChange} suggestions={groupNames} />
          </div>
        )}
      </form.Field>

      <form.Field name="images">
        {(f) => (
          <div className="space-y-1">
            <Label>Images</Label>
            <ImageField value={f.state.value} onChange={f.handleChange} upload={upload} />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-3">
        {text("sku", "SKU / part no.")}
        {text("extBarcode", "Manufacturer barcode (EAN/UPC)")}
        {text("supplier", "Supplier")}
        {number("unitCost", "Unit cost")}
        {date("purchasedAt", "Purchased")}
        {date("expiresAt", "Expiry / warranty")}
      </div>
      {text("productUrl", "Link", "url")}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onClose()}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {item ? "Save" : "Create"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
