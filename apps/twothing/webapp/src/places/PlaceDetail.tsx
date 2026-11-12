import { cn } from "@twodb/blocks";
import { History, MoveRight, Package, Pencil, Plus, Printer, QrCode, ScanLine, Waypoints } from "lucide-react";
import { api } from "../lib/api";
import { kindOf } from "../lib/catalog";
import { Link } from "../lib/router";
import { ItemRow } from "../items/partials/ItemRow";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { ActivityList } from "../ui/ActivityList";
import { EmptyState } from "../ui/EmptyState";
import { PlacePath } from "../ui/PlacePath";
import { Page, PageHeader, Section, Spinner, btn } from "../ui/Page";
import { QrSvg } from "../ui/QrSvg";
import { usePlaceDetail } from "./hooks/usePlaceDetail";

export function PlaceDetail({ id }: { id: string }) {
  const h = usePlaceDetail(id);
  const p = h.place;
  if (h.notFound) return <Page><PageHeader title="Place not found" onBack="/places" /></Page>;
  if (h.loading || !p) return <Spinner />;
  const kind = kindOf(p.kind);
  const Icon = kind.icon;
  const empty = h.children.length === 0 && h.items.length === 0;

  return (
    <Page>
      <PageHeader
        onBack="/places"
        eyebrow={<PlacePath path={p.path.slice(0, -1)} className="text-sm" />}
        title={
          <span className="inline-flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-outline bg-card">
              <Icon className="size-6" />
            </span>
            {p.name}
          </span>
        }
        subtitle={`${kind.label} · ${p.totalItemCount} item${p.totalItemCount === 1 ? "" : "s"}${p.childCount ? ` · ${p.childCount} place${p.childCount === 1 ? "" : "s"} inside` : ""}${p.description ? ` — ${p.description}` : ""}`}
        actions={
          <>
            <button className={btn.secondary} onClick={h.putAway}>
              <Waypoints className="size-4" /> Put away here
            </button>
            <button className={btn.secondary} onClick={h.edit}>
              <Pencil className="size-4" /> Edit
            </button>
            <button className={btn.primary} onClick={h.addItem}>
              <Plus className="size-4" /> Add item
            </button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {p.imageId && <img src={api.imageUrl(p.imageId)} alt="" className="max-h-72 w-full rounded-[18px] border border-outline object-cover" />}

          {h.children.length > 0 && (
            <Section title="Inside" action={<button className={cn(btn.ghost, "px-2 py-1 text-xs")} onClick={h.addChild}><Plus className="size-3.5" /> Place</button>}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {h.children.map((c) => {
                  const CI = kindOf(c.kind).icon;
                  return (
                    <Link key={c.id} to={`/places/${c.id}`} className="group flex items-center gap-3 rounded-2xl border border-outline bg-paper p-3 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-md">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone">
                        <CI className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.name}</span>
                        <span className="block text-xs text-ink-muted">
                          {c.totalItemCount} item{c.totalItemCount === 1 ? "" : "s"}
                          {c.codeDisplay ? ` · ${c.codeDisplay}` : ""}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {h.items.length > 0 && (
            <Section
              title={`Items here (${h.items.length})`}
              action={
                <div className="flex gap-1">
                  {p.childCount > 0 && (
                    <button className={cn(btn.ghost, "px-2 py-1 text-xs")} onClick={h.allItems}>
                      Incl. nested ({p.totalItemCount})
                    </button>
                  )}
                  <button className={cn(btn.ghost, "px-2 py-1 text-xs")} onClick={h.printContents}>
                    <Printer className="size-3.5" /> Labels
                  </button>
                </div>
              }
            >
              <div className="-mx-2 divide-y divide-outline">
                {h.items.map((it) => (
                  <ItemRow key={it.id} item={it} onOpen={() => h.openItem(it)} onDelta={(d) => h.onDelta(it, d)} />
                ))}
              </div>
            </Section>
          )}

          {empty && (
            <EmptyState
              icon={Package}
              title={`${p.name} is empty`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button className={btn.primary} onClick={h.putAway}>
                    <Waypoints className="size-4" /> Scan things into it
                  </button>
                  <button className={btn.secondary} onClick={h.addItem}>
                    <Plus className="size-4" /> Add item
                  </button>
                  <button className={btn.secondary} onClick={h.addChild}>
                    <Plus className="size-4" /> Place inside
                  </button>
                </div>
              }
            >
              Put-away mode: scan this {kind.label.toLowerCase()}'s label once, then scan each thing you drop in.
            </EmptyState>
          )}

          {!empty && p.totalItemCount > h.items.length && h.items.length === 0 && (
            <button className={btn.secondary} onClick={h.allItems}>
              Show all {p.totalItemCount} nested items
            </button>
          )}
        </div>

        <div className="space-y-4">
          <Section title={<span className="inline-flex items-center gap-1.5"><QrCode className="size-3.5" /> Label</span>}>
            {p.code ? (
              <div className="flex items-center gap-4">
                <QrSvg text={p.code} className="size-24 rounded-lg border border-outline" />
                <div className="space-y-1">
                  <div className="font-mono text-2xl font-bold tracking-[0.15em]">{p.codeDisplay}</div>
                  <button className={cn(btn.secondary, "px-3 py-1 text-xs")} onClick={h.print}>
                    <Printer className="size-3.5" /> Print
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ink-muted">Label it so you can scan it for put-away and lookups.</p>
                <button className={btn.primary} onClick={() => void h.assignLabel()}>
                  <ScanLine className="size-4" /> Scan a sticker
                </button>
              </div>
            )}
          </Section>
          <Section title="Organize">
            <div className="flex flex-col gap-2">
              <button className={cn(btn.secondary, "justify-start")} onClick={() => h.setMoveOpen(true)}>
                <MoveRight className="size-4" /> Move this {kind.label.toLowerCase()}…
              </button>
              <button className={cn(btn.secondary, "justify-start")} onClick={h.addChild}>
                <Plus className="size-4" /> Add a place inside
              </button>
            </div>
          </Section>
          <Section title={<span className="inline-flex items-center gap-1.5"><History className="size-3.5" /> History</span>}>
            <ActivityList entries={h.activity} />
          </Section>
        </div>
      </div>
      <PlacePickerDialog open={h.moveOpen} onOpenChange={h.setMoveOpen} onPick={(x) => void h.moveTo(x)} exclude={p.id} selectedId={p.parentId} title={`Move “${p.name}” into…`} allowNone />
    </Page>
  );
}
