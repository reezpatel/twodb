import { CheckSquare, Package, Plus, SearchX } from "lucide-react";
import { Link } from "../lib/router";
import { categoryOf } from "../lib/catalog";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { EmptyState } from "../ui/EmptyState";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";
import { useItemsPage } from "./hooks/useItemsPage";
import { BulkBar } from "./partials/BulkBar";
import { FilterBar } from "./partials/FilterBar";
import { ItemCard } from "./partials/ItemCard";
import { ItemRow } from "./partials/ItemRow";

export function ItemsPage() {
  const h = useItemsPage();
  const title = h.filters.category ? categoryOf(h.filters.category).label : h.filters.q ? `“${h.filters.q}”` : "All items";
  return (
    <Page wide>
      <PageHeader
        title={title}
        subtitle={h.loading ? "Loading…" : `${h.items.length} item${h.items.length === 1 ? "" : "s"}${h.refreshing ? " · refreshing" : ""}`}
        actions={
          <>
            <button className={btn.secondary} onClick={() => h.setSelecting(!h.selecting)}>
              <CheckSquare className="size-4" /> {h.selecting ? "Done" : "Select"}
            </button>
            <Link to={`/items/new${h.filters.category ? `?category=${h.filters.category}` : ""}${h.filters.locationId ? `${h.filters.category ? "&" : "?"}loc=${h.filters.locationId}` : ""}`} className={btn.primary}>
              <Plus className="size-4" /> Add
            </Link>
          </>
        }
      />
      <FilterBar filters={h.filters} filterPlace={h.filterPlace} setFilter={h.setFilter} toggle={h.toggle} view={h.view} setView={h.setView} />

      <div className="mt-5">
        {h.loading ? (
          <Spinner />
        ) : h.items.length === 0 ? (
          h.activeFilters ? (
            <EmptyState icon={SearchX} title="Nothing matches" action={<button className={btn.secondary} onClick={h.clearFilters}>Clear filters</button>}>
              Try fewer words or a different category. Search covers names, specs, tags, part numbers and labels.
            </EmptyState>
          ) : (
            <EmptyState icon={Package} title="Your inventory is empty" action={<Link to="/items/new" className={btn.primary}><Plus className="size-4" /> Add your first item</Link>}>
              Add things one by one, scan a pre-printed label to start, or import a CSV under Import &amp; export.
            </EmptyState>
          )
        ) : h.view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {h.items.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                onOpen={() => (h.selecting ? h.toggleSelect(it.id) : h.open(it))}
                onDelta={(d) => h.onDelta(it, d)}
                onFavorite={() => h.toggleFavorite(it)}
                selecting={h.selecting}
                selected={h.selected.has(it.id)}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-outline overflow-hidden rounded-[18px] border border-outline bg-card">
            {h.items.map((it) => (
              <ItemRow key={it.id} item={it} onOpen={() => (h.selecting ? h.toggleSelect(it.id) : h.open(it))} onDelta={(d) => h.onDelta(it, d)} selecting={h.selecting} selected={h.selected.has(it.id)} />
            ))}
          </div>
        )}
      </div>

      {h.selecting && <BulkBar count={h.selected.size} onMove={() => h.setMoveOpen(true)} onPrint={h.printSelected} onAll={h.selectAll} onCancel={() => h.setSelecting(false)} />}
      <PlacePickerDialog open={h.moveOpen} onOpenChange={h.setMoveOpen} onPick={(p) => void h.moveSelected(p)} title={`Move ${h.selected.size} item${h.selected.size === 1 ? "" : "s"} to…`} />
    </Page>
  );
}
