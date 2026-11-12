import { ChevronsDownUp, ChevronsUpDown, MapPinOff, Plus, Search, Warehouse, Waypoints } from "lucide-react";
import { Link } from "../lib/router";
import { EmptyState } from "../ui/EmptyState";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";
import { usePlacesPage } from "./hooks/usePlacesPage";
import { PlaceTreeRow } from "./partials/PlaceTreeRow";

export function PlacesPage() {
  const h = usePlacesPage();
  return (
    <Page>
      <PageHeader
        title="Places"
        subtitle="Rooms, shelves, drawers, boxes — nest them as deep as you like. Each one can carry a label."
        actions={
          <>
            <button className={btn.secondary} onClick={h.putAway}>
              <Waypoints className="size-4" /> Put away
            </button>
            <Link to="/places/new" className={btn.primary}>
              <Plus className="size-4" /> Add place
            </Link>
          </>
        }
      />
      {h.loading ? (
        <Spinner />
      ) : h.total === 0 ? (
        <EmptyState icon={Warehouse} title="No places yet" action={<Link to="/places/new" className={btn.primary}><Plus className="size-4" /> Create your first place</Link>}>
          Start big (“Workshop”), then add what's inside (“Shelf A” → “SMD box 1”). Stick a label on every box so you can scan it.
        </EmptyState>
      ) : (
        <div className="rounded-[18px] border border-outline bg-card p-2 md:p-3">
          <div className="mb-2 flex items-center gap-2 p-1">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-muted" />
              <input value={h.q} onChange={(e) => h.setQ(e.target.value)} placeholder={`Filter ${h.total} places…`} className="h-9 w-full rounded-full border border-outline bg-paper pr-3 pl-9 text-sm outline-none focus:border-ink/30" />
            </div>
            <button className={btn.icon} title="Expand all" onClick={h.expandAll}>
              <ChevronsUpDown className="size-4" />
            </button>
            <button className={btn.icon} title="Collapse all" onClick={h.collapseAll}>
              <ChevronsDownUp className="size-4" />
            </button>
          </div>
          {h.visible.map((p) => (
            <PlaceTreeRow key={p.id} place={p} collapsed={h.collapsed.has(p.id)} onToggle={() => h.toggle(p.id)} flat={h.searching} />
          ))}
          {h.searching && h.visible.length === 0 && <div className="py-8 text-center text-sm text-ink-muted">No places match.</div>}
          {h.unplacedCount > 0 && !h.searching && (
            <Link to="/items?unplaced=1" className="mt-2 flex items-center gap-2.5 rounded-xl border border-dashed border-outline px-3 py-2.5 text-sm text-ink-muted hover:border-ink/30 hover:text-ink">
              <MapPinOff className="size-4" /> {h.unplacedCount} unplaced item{h.unplacedCount === 1 ? "" : "s"} — give them a home
            </Link>
          )}
        </div>
      )}
    </Page>
  );
}
