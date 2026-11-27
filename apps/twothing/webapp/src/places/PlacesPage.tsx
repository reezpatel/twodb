import { ChevronsDownUp, ChevronsUpDown, MapPinOff, Plus, Search, Waypoints } from "lucide-react";
import { Link } from "../lib/router";
import { DataTable, TableCard, TableEmpty, Td } from "../ui/DataTable";
import { Page, PageHeader, Spinner } from "../ui/Page";
import { usePlacesPage } from "./hooks/usePlacesPage";
import { PlaceTreeRow } from "./partials/PlaceTreeRow";

const ctl =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-ink/20 bg-transparent px-3 text-[12px] font-medium transition hover:bg-stone active:scale-[0.98]";
const iconCtl = "grid size-8 shrink-0 place-items-center rounded-[6px] border border-ink/20 text-ink-muted transition hover:bg-stone hover:text-ink";

export function PlacesPage() {
  const h = usePlacesPage();
  return (
    <Page>
      <PageHeader title="Places" />

      {h.loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-ink-muted" />
              <input
                value={h.q}
                onChange={(e) => h.setQ(e.target.value)}
                placeholder={`Filter ${h.total} places…`}
                className="h-8 w-full rounded-[6px] border border-ink/20 bg-transparent pr-3 pl-8 text-[13px] outline-none transition placeholder:text-ink-muted focus:border-ink/50"
              />
            </div>
            <button className={iconCtl} title="Expand all" aria-label="Expand all" onClick={h.expandAll}>
              <ChevronsUpDown className="size-3.5" />
            </button>
            <button className={iconCtl} title="Collapse all" aria-label="Collapse all" onClick={h.collapseAll}>
              <ChevronsDownUp className="size-3.5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button className={ctl} onClick={h.putAway}>
                <Waypoints className="size-3.5" /> Put away
              </button>
              <Link
                to="/places/new"
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-paper transition hover:bg-ink/90"
              >
                <Plus className="size-3.5" /> Add place
              </Link>
            </div>
          </div>

          <TableCard>
            {h.total === 0 ? (
              <TableEmpty>No places yet. Start big (“Workshop”), then add what's inside (“Shelf A” → “SMD box 1”).</TableEmpty>
            ) : h.searching && h.visible.length === 0 ? (
              <TableEmpty>No places match.</TableEmpty>
            ) : (
              <DataTable minWidth={560} columns={["Place", { label: "Type", mobile: false }, { label: "Code", mobile: false }, "Items", ""]}>
                {h.visible.map((p) => (
                  <PlaceTreeRow key={p.id} place={p} collapsed={h.collapsed.has(p.id)} onToggle={() => h.toggle(p.id)} flat={h.searching} />
                ))}
                {h.unplacedCount > 0 && !h.searching && (
                  <tr className="text-[12px]">
                    <Td className="h-11" hideOnMobile={false}>
                      <Link to="/items?unplaced=1" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink">
                        <MapPinOff className="size-3.5" /> {h.unplacedCount} unplaced item{h.unplacedCount === 1 ? "" : "s"}: give them a home
                      </Link>
                    </Td>
                    <Td className="h-11">{null}</Td>
                    <Td className="h-11">{null}</Td>
                    <Td className="h-11">{null}</Td>
                    <Td className="h-11">{null}</Td>
                  </tr>
                )}
              </DataTable>
            )}
          </TableCard>
        </div>
      )}
    </Page>
  );
}
