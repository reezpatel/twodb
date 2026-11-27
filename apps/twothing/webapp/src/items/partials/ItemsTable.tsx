import { cn } from "@twodb/blocks";
import { Check, Star } from "lucide-react";
import type { Item } from "../../lib/types";
import { CodeChip } from "../../ui/CodeChip";
import { DataTable, TableCard, Td, Tr } from "../../ui/DataTable";
import { PlacePath } from "../../ui/PlacePath";
import { formatQty } from "../../lib/format";

export interface ItemsTableProps {
  items: Item[];
  selected?: Set<string>;
  onOpen: (item: Item) => void;
  onSelect?: (id: string) => void;
  showPlace?: boolean;
}

/** Items list view — same table styling as the Dispatch dashboards. */
export function ItemsTable({ items, selected, onOpen, onSelect, showPlace = true }: ItemsTableProps) {
  return (
    <TableCard>
      <DataTable
        minWidth={showPlace ? 640 : 480}
        columns={[...(onSelect ? [""] : []), "Item", ...(showPlace ? [{ label: "Place", mobile: false }] : []), { label: "Code", mobile: false }, "Quantity"]}
      >
        {items.map((it) => {
          const on = !!selected?.has(it.id);
          return (
            <Tr key={it.id} onClick={() => onOpen(it)} className={cn(on && "bg-stone/70")}>
              {onSelect && (
                <Td className="w-10">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={on ? "Deselect" : "Select"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect?.(it.id);
                    }}
                    className={cn("grid size-5 place-items-center rounded-full border-2", on ? "border-ink bg-ink text-paper" : "border-outline")}
                  >
                    {on && <Check className="size-3" />}
                  </button>
                </Td>
              )}
              <Td className="max-w-72">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-ink">{it.name}</span>
                  {it.favorite && <Star className="size-3 shrink-0 text-amber-500" fill="currentColor" />}
                  {it.low && <span className="shrink-0 rounded-[6px] bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">LOW</span>}
                </div>
              </Td>
              {showPlace && (
                <Td hideOnMobile className="max-w-64">
                  <PlacePath path={it.locationPath} compact />
                </Td>
              )}
              <Td hideOnMobile>
                <CodeChip code={it.codeDisplay} muted />
              </Td>
              <Td>
                <span className={cn("font-semibold tabular-nums", it.low && "text-destructive")}>{formatQty(it.quantity)}</span>{" "}
                <span className="text-[10px] tracking-wider text-ink-muted uppercase">{it.unit}</span>
              </Td>
            </Tr>
          );
        })}
      </DataTable>
    </TableCard>
  );
}
