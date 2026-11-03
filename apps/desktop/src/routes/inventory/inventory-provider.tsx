import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Boxes, Layers, MapPinOff, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SideNav, SideNavGroup, SideNavHeader, SideNavItem } from "@/components/side-nav";
import { useInventory, type InventoryHook } from "./use-inventory";
import { buildLocationTree, flattenTree } from "./location-tree";

export const InventoryContext = createContext<InventoryHook | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const inventory = useInventory();
  return <InventoryContext.Provider value={inventory}>{children}</InventoryContext.Provider>;
}

export function useInventoryContext() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventoryContext must be used within InventoryProvider");
  return ctx;
}

export function InventorySidenav() {
  const inv = useInventoryContext();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const list = inv.inventories.data?.inventories ?? [];
  const summary = inv.summary.data;
  const tree = useMemo(() => flattenTree(buildLocationTree(inv.locations.data?.locations ?? [])), [inv.locations.data]);
  const select = (filter: Parameters<typeof inv.setFilter>[0]) => {
    inv.setFilter(filter);
    inv.setTab("items");
  };
  const isAll = inv.filter.kind === "all";

  return (
    <SideNav>
      <SideNavHeader title="Inventory" />
      <div className="flex items-center gap-1.5 px-1">
        {list.length > 0 ? (
          <select
            className="border-input bg-background focus:border-ring focus:ring-ring/50 h-8 min-w-0 flex-1 rounded-md border px-2 text-sm shadow-xs focus:outline-none"
            value={inv.id ?? ""}
            onChange={(e) => inv.selectInventory(e.target.value)}
          >
            {list.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground flex-1 text-xs">No inventory yet</span>
        )}
        <Button size="icon-sm" variant="ghost" title="New inventory" onClick={() => setCreating(true)}>
          <Plus size={14} />
        </Button>
      </div>

      {inv.inventory ? (
        <>
          <SideNavGroup label="Browse">
            <SideNavItem label="All items" icon={Boxes} count={summary?.items} active={isAll} onSelect={() => select({ kind: "all" })} />
            <SideNavItem label="Low stock" icon={AlertTriangle} count={summary?.lowStock} active={inv.filter.kind === "low"} onSelect={() => select({ kind: "low" })} />
            <SideNavItem label="No location" icon={MapPinOff} count={summary?.unplaced} active={inv.filter.kind === "unplaced"} onSelect={() => select({ kind: "unplaced" })} />
          </SideNavGroup>

          {(inv.groups.data?.groups.length ?? 0) > 0 ? (
            <SideNavGroup label="Groups" separated>
              {inv.groups.data!.groups.map((g) => (
                <SideNavItem
                  key={g.name}
                  label={g.name}
                  icon={Tag}
                  count={g.count}
                  active={inv.filter.kind === "group" && inv.filter.group === g.name}
                  onSelect={() => select({ kind: "group", group: g.name })}
                />
              ))}
            </SideNavGroup>
          ) : null}

          <SideNavGroup label="Locations" separated>
            {tree.length === 0 ? <span className="text-muted-foreground/70 px-2 pb-1 text-xs">No locations yet</span> : null}
            {tree.map((l) => (
              <div key={l.id} style={{ paddingLeft: l.depth * 12 }}>
                <SideNavItem
                  label={l.title || "Untitled"}
                  icon={Layers}
                  count={l.totalItems}
                  active={inv.filter.kind === "location" && inv.filter.locationId === l.id}
                  onSelect={() => select({ kind: "location", locationId: l.id })}
                />
              </div>
            ))}
            <SideNavItem label="Add location" icon={Plus} onSelect={() => inv.setLocationForm({ location: null })} />
          </SideNavGroup>
        </>
      ) : null}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New inventory</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="Name (e.g. Workshop)" value={name} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button
              size="sm"
              disabled={!name.trim() || inv.createInventory.isPending}
              onClick={() =>
                inv.createInventory.mutate(name.trim(), {
                  onSuccess: () => {
                    setCreating(false);
                    setName("");
                  },
                })
              }
            >
              Create
            </Button>
          </DialogFooter>
          {inv.createInventory.isError ? <p className="text-destructive text-xs">{inv.createInventory.error.message}</p> : null}
        </DialogContent>
      </Dialog>
    </SideNav>
  );
}
