import { cn } from "@twodb/blocks";
import { Trash2 } from "lucide-react";
import { PLACE_KINDS } from "../lib/catalog";
import { back } from "../lib/router";
import { LabelField } from "../items/partials/LabelField";
import { PhotoStrip } from "../items/partials/PhotoStrip";
import { PlaceField } from "../items/partials/PlaceField";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { Card, Field, inputCls, textareaCls } from "../ui/Field";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";
import { usePlaceEditor } from "./hooks/usePlaceEditor";

export function PlaceEditor({ id }: { id?: string }) {
  const h = usePlaceEditor(id);
  const d = h.draft;
  if (h.notFound) return <Page><PageHeader title="Place not found" onBack="/places" /></Page>;
  if (!h.loaded) return <Spinner />;
  return (
    <Page className="max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void h.save(false);
        }}
      >
        <PageHeader onBack="/places" title={h.isEdit ? `Edit ${d.name || "place"}` : "New place"} subtitle={h.parent ? `Inside ${h.parent.path.map((c) => c.name).join(" › ")}` : "At the top level"} />
        <div className="space-y-4">
          <Card>
            <Field label="Name">
              <input autoFocus value={d.name} onChange={(e) => h.set("name", e.target.value)} placeholder="e.g. SMD resistors box, Shelf B, Craft drawer 3" className={cn(inputCls, "h-12 text-lg font-semibold")} />
            </Field>
            <Field label="Kind">
              <div className="grid grid-cols-5 gap-2">
                {PLACE_KINDS.map((k) => (
                  <button
                    type="button"
                    key={k.id}
                    onClick={() => h.set("kind", k.id)}
                    className={cn("flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[11px] font-semibold transition active:scale-95", d.kind === k.id ? "border-ink bg-ink text-paper" : "border-outline bg-paper hover:border-ink/25")}
                  >
                    <k.icon className="size-5" />
                    {k.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Inside">
              <PlaceField place={h.parent} onOpen={() => h.setParentOpen(true)} onScan={() => void h.scanParent()} onClear={() => h.set("parentId", null)} placeholder="Top level" />
            </Field>
            <Field label="Description">
              <textarea rows={2} value={d.description} onChange={(e) => h.set("description", e.target.value)} placeholder="What goes here?" className={textareaCls} />
            </Field>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Label">
              <LabelField code={d.code} status={h.labelStatus} autoCode={d.autoCode} onChange={(v) => h.set("code", v)} onScan={() => void h.scanLabel()} onAuto={(on) => h.set("autoCode", on)} entity="place" />
            </Card>
            <Card title="Photo">
              <PhotoStrip imageIds={d.imageId ? [d.imageId] : []} uploading={h.uploading} onAdd={(f) => void h.addPhoto(f)} onRemove={() => h.set("imageId", null)} onCover={() => {}} />
            </Card>
          </div>
          {h.isEdit && (
            <button type="button" onClick={() => void h.remove()} className={btn.danger}>
              <Trash2 className="size-4" /> Delete place
            </button>
          )}
        </div>
        <div className="sticky bottom-20 z-20 mt-6 md:bottom-4">
          <div className="flex items-center gap-2 rounded-full border border-outline bg-paper/90 p-2 shadow-xl backdrop-blur">
            {h.error && <span className="px-3 text-sm font-medium text-destructive">{h.error}</span>}
            <div className="ml-auto flex gap-2">
              <button type="button" className={btn.ghost} onClick={() => back("/places")}>
                Cancel
              </button>
              {!h.isEdit && (
                <button type="button" disabled={h.saving} className={btn.secondary} onClick={() => void h.save(true)}>
                  Save & add another
                </button>
              )}
              <button type="submit" disabled={h.saving || h.uploading > 0} className={btn.primary}>
                {h.saving ? "Saving…" : h.isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </form>
      <PlacePickerDialog
        open={h.parentOpen}
        onOpenChange={h.setParentOpen}
        exclude={id}
        selectedId={d.parentId}
        title="Put it inside…"
        onPick={(p) => {
          h.set("parentId", p?.id ?? null);
          h.setParentOpen(false);
        }}
      />
    </Page>
  );
}
