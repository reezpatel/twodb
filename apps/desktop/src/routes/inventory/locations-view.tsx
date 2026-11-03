import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MapPinned, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inventoryErrorMessage, type InventoryLocation } from "./inventory-api";
import { useInventoryContext } from "./inventory-provider";
import { buildLocationTree, flattenTree } from "./location-tree";

interface LocationsViewProps {
  onEdit: (target: { location: InventoryLocation | null; parentId?: string }) => void;
  onPrintLabel: (location: InventoryLocation) => void;
}

export function LocationsView({ onEdit, onPrintLabel }: LocationsViewProps) {
  const inv = useInventoryContext();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const roots = useMemo(() => buildLocationTree(inv.locations.data?.locations ?? []), [inv.locations.data]);
  const rows = useMemo(() => flattenTree(roots, collapsed), [roots, collapsed]);

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const remove = (l: InventoryLocation) => {
    if (!window.confirm(`Delete "${l.title}"?`)) return;
    setError(null);
    inv.deleteLocation.mutate(l.id, { onError: (e) => setError(inventoryErrorMessage(e)) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Warehouses, racks, shelves and boxes — nest them as deep as you need.</p>
        <Button size="sm" onClick={() => onEdit({ location: null })}>
          <Plus /> New location
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {rows.length === 0 && !inv.locations.isPending ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-sm">
          <MapPinned size={28} className="text-muted-foreground/50" />
          No locations yet.
        </div>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {rows.map((l) => (
          <li key={l.id} className="hover:bg-accent/30 flex items-center gap-2 py-2 pr-2 text-sm" style={{ paddingLeft: 8 + l.depth * 20 }}>
            <button type="button" className="text-muted-foreground size-5 shrink-0" onClick={() => toggle(l.id)} aria-label="Toggle" disabled={l.children.length === 0}>
              {l.children.length === 0 ? null : collapsed.has(l.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                inv.setFilter({ kind: "location", locationId: l.id });
                inv.setTab("items");
              }}
              title="Show items stored here"
            >
              <span className="truncate font-medium">{l.title || "Untitled"}</span>
              {l.kind ? <span className="text-muted-foreground ml-2 text-xs capitalize">{l.kind}</span> : null}
              {l.code ? <span className="text-muted-foreground ml-2 font-mono text-[11px]">{`${l.code.slice(0, 4)}-${l.code.slice(4)}`}</span> : null}
            </button>
            <Badge variant="secondary" className="tabular-nums" title="Items here (including sub-locations)">
              {l.totalItems}
            </Badge>
            <div className="flex shrink-0 gap-0.5">
              <Button size="icon-xs" variant="ghost" title="Add inside" onClick={() => onEdit({ location: null, parentId: l.id })}>
                <Plus />
              </Button>
              <Button size="icon-xs" variant="ghost" title="Print label" onClick={() => onPrintLabel(l)}>
                <Printer />
              </Button>
              <Button size="icon-xs" variant="ghost" title="Edit" onClick={() => onEdit({ location: l })}>
                <Pencil />
              </Button>
              <Button size="icon-xs" variant="ghost" title="Show items" onClick={() => { inv.setFilter({ kind: "location", locationId: l.id }); inv.setTab("items"); }}>
                <Search />
              </Button>
              <Button size="icon-xs" variant="ghost" className="text-destructive" title="Delete" onClick={() => remove(l)}>
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
