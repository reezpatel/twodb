import { Package, Plus, SearchX } from "lucide-react";
import { categoryOf } from "../lib/catalog";
import { Link } from "../lib/router";
import { PlacePickerDialog } from "../pickers/PlacePickerDialog";
import { EmptyState } from "../ui/EmptyState";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";
import { useItemsPage } from "./hooks/useItemsPage";
import { BulkBar } from "./partials/BulkBar";
import { FilterBar } from "./partials/FilterBar";
import { ItemCard } from "./partials/ItemCard";
import { ItemsTable } from "./partials/ItemsTable";

export function ItemsPage() {
  const h = useItemsPage();
  const title = h.filters.category ? categoryOf(h.filters.category).label : h.filters.q ? `“${h.filters.q}”` : "All items";
  return (
    <Page>
      <PageHeader title={title} />
      <FilterBar filters={h.filters} filterPlace={h.filterPlace} setFilter={h.setFilter} toggle={h.toggle} view={h.view} setView={h.setView} />

      <div className="mt-5">
        {h.loading ? (
          <Spinner />
        ) : h.items.length === 0 ? (
          h.activeFilters ? (
            <EmptyState icon={SearchX} title="Nothing matches">
              Try fewer words or a different category. Search covers names, specs, tags, part numbers and labels.
            </EmptyState>
          ) : (
            <EmptyState
              icon={Package}
              title="Your inventory is empty"
              action={
                <Link to="/items/new" className={btn.primary}>
                  <Plus className="size-4" /> Add your first item
                </Link>
              }
            >
              Add things one by one, scan a pre-printed label to start, or import a CSV under Import &amp; export.
            </EmptyState>
          )
        ) : h.view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {h.items.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                onOpen={() => h.open(it)}
                onSelect={() => h.toggleSelect(it.id)}
                onDelta={(d) => h.onDelta(it, d)}
                onFavorite={() => h.toggleFavorite(it)}
                selected={h.selected.has(it.id)}
              />
            ))}
          </div>
        ) : (
          <ItemsTable items={h.items} selected={h.selected} onOpen={h.open} onSelect={h.toggleSelect} />
        )}
      </div>

      {h.selected.size > 0 && (
        <BulkBar count={h.selected.size} onMove={() => h.setMoveOpen(true)} onPrint={h.printSelected} onAll={h.selectAll} onCancel={h.clearSelection} />
      )}
      <PlacePickerDialog
        open={h.moveOpen}
        onOpenChange={h.setMoveOpen}
        onPick={(p) => void h.moveSelected(p)}
        title={`Move ${h.selected.size} item${h.selected.size === 1 ? "" : "s"} to…`}
      />
    </Page>
  );
}
