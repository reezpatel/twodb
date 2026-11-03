import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LOCATION_KINDS, type LocationFormTarget } from "./inventory-api";
import { ImageField } from "./image-field";
import { LocationSelect } from "./location-select";
import { useLocationForm } from "./use-location-form";

interface LocationFormDialogProps {
  target: LocationFormTarget | null;
  onClose: () => void;
}

export function LocationFormDialog({ target, onClose }: LocationFormDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target?.location ? "Edit location" : "New location"}</DialogTitle>
        </DialogHeader>
        {target ? <LocationForm target={target} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LocationForm({ target, onClose }: { target: LocationFormTarget; onClose: () => void }) {
  const { form, error, locations, exclude, upload } = useLocationForm(target, onClose);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="title" validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : "Required") }}>
        {(f) => (
          <div className="space-y-1">
            <Label htmlFor="loc-title">Name</Label>
            <Input id="loc-title" autoFocus placeholder="Rack 3" value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
            {f.state.meta.errors.length > 0 ? <p className="text-destructive text-xs">{String(f.state.meta.errors[0])}</p> : null}
          </div>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="kind">
          {(f) => (
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                className="border-input bg-background focus:border-ring focus:ring-ring/50 h-9 w-full rounded-md border px-2 text-sm shadow-xs focus:outline-none"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              >
                {LOCATION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>
        <form.Field name="parentId">
          {(f) => (
            <div className="space-y-1">
              <Label>Inside</Label>
              <LocationSelect locations={locations} value={f.state.value} onChange={f.handleChange} placeholder="Top level" exclude={exclude} />
            </div>
          )}
        </form.Field>
      </div>
      <form.Field name="description">
        {(f) => (
          <div className="space-y-1">
            <Label htmlFor="loc-desc">Description</Label>
            <Textarea id="loc-desc" rows={2} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} />
          </div>
        )}
      </form.Field>
      <form.Field name="images">
        {(f) => (
          <div className="space-y-1">
            <Label>Photos</Label>
            <ImageField value={f.state.value} onChange={f.handleChange} upload={upload} />
          </div>
        )}
      </form.Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
