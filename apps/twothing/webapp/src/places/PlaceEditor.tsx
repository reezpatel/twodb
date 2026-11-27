import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@twodb/blocks";
import { Camera, ChevronDown, ChevronsUpDown, CircleCheck, CircleX, Loader2, ScanLine, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { PLACE_KINDS, kindOf } from "../lib/catalog";
import { back } from "../lib/router";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { Group, Row, control } from "../ui/FormKit";
import { Page, PageHeader, Spinner, cbtn } from "../ui/Page";
import { Switch } from "../ui/Switch";
import { usePlaceEditor } from "./hooks/usePlaceEditor";

export function PlaceEditor({ id }: { id?: string }) {
  const h = usePlaceEditor(id);
  const d = h.draft;
  if (h.notFound)
    return (
      <Page>
        <PageHeader title="Place not found" onBack="/places" />
      </Page>
    );
  if (!h.loaded) return <Spinner />;

  const kind = kindOf(d.kind);
  const KindIcon = kind.icon;
  const ParentIcon = h.parent ? kindOf(h.parent.kind).icon : null;
  const st = h.labelStatus;

  return (
    <Page>
      <PageHeader
        onBack="/places"
        trail={h.parent?.path.map((c) => ({ label: c.name, to: `/places/${c.id}` }))}
        title={h.isEdit ? `Edit ${d.name || "place"}` : "New place"}
      />
      <form
        className="mx-auto max-w-3xl space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void h.save(false);
        }}
      >
        <div>
          {d.imageId ? (
            <div className="group relative size-32 overflow-hidden rounded-[6px] border border-outline bg-stone">
              <img src={api.imageUrl(d.imageId)} alt="" className="size-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => h.set("imageId", null)}
                className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-[6px] bg-paper/90 text-ink-muted transition hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex size-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border border-dashed border-ink/25 text-[12px] text-ink-muted transition hover:border-ink/50 hover:bg-stone hover:text-ink">
              {h.uploading > 0 ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" strokeWidth={1.5} />}
              {h.uploading > 0 ? "Uploading…" : "Add photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && void h.addPhoto(e.target.files)} />
            </label>
          )}
        </div>

        <Group title="Details">
          <Row label="Name">
            <input autoFocus value={d.name} onChange={(e) => h.set("name", e.target.value)} placeholder="e.g. SMD resistors box, Shelf B" className={control} />
          </Row>
          <Row label="Kind">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={cn(control, "flex items-center gap-2 text-left")}>
                  <KindIcon className="size-3.5 shrink-0 text-ink-muted" />
                  <span className="flex-1 truncate">{kind.label}</span>
                  <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={d.kind} onValueChange={(v) => h.set("kind", v)}>
                  {PLACE_KINDS.map((k) => (
                    <DropdownMenuRadioItem key={k.id} value={k.id}>
                      <k.icon className="size-3.5" /> {k.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Row>
          <Row label="Inside" hint="Where this place sits">
            <div className="flex gap-2">
              <button type="button" onClick={() => h.setParentOpen(true)} className={cn(control, "flex min-w-0 flex-1 items-center gap-2 text-left")}>
                {ParentIcon && <ParentIcon className="size-3.5 shrink-0 text-ink-muted" />}
                {h.parent ? (
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-ink-muted">{h.parent.path.slice(0, -1).map((c) => c.name + " › ")}</span>
                    {h.parent.name}
                  </span>
                ) : (
                  <span className="flex-1 text-ink-muted">Top level</span>
                )}
                {h.parent ? (
                  <X
                    className="size-3.5 shrink-0 text-ink-muted hover:text-ink"
                    onClick={(e) => {
                      e.stopPropagation();
                      h.set("parentId", null);
                    }}
                  />
                ) : (
                  <ChevronsUpDown className="size-3.5 shrink-0 text-ink-muted" />
                )}
              </button>
              <button type="button" onClick={() => void h.scanParent()} title="Scan the parent's label" className={cbtn.secondary}>
                <ScanLine className="size-3.5" /> Scan
              </button>
            </div>
          </Row>
          <Row label="Description">
            <textarea
              rows={2}
              value={d.description}
              onChange={(e) => h.set("description", e.target.value)}
              placeholder="What goes here?"
              className={cn(control, "h-auto py-1.5")}
            />
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
        </Group>

        {h.error && <p className="text-[13px] font-medium text-destructive">{h.error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {h.isEdit && (
            <button
              type="button"
              onClick={() => void h.remove()}
              className={cn(cbtn.secondary, "border-destructive/40 text-destructive hover:bg-destructive/10")}
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className={cbtn.secondary} onClick={() => back("/places")}>
              Cancel
            </button>
            {!h.isEdit && (
              <button type="button" disabled={h.saving} className={cbtn.secondary} onClick={() => void h.save(true)}>
                Save & add another
              </button>
            )}
            <button type="submit" disabled={h.saving || h.uploading > 0} className={cbtn.primary}>
              {h.saving ? "Saving…" : h.isEdit ? "Save" : "Create"}
            </button>
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
