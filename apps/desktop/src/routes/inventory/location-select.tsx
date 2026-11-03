import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { InventoryLocation } from "./inventory-api";
import { buildLocationTree, flattenTree } from "./location-tree";

interface LocationSelectProps {
  locations: InventoryLocation[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Locations that can't be picked (e.g. a location and its descendants as its own parent). */
  exclude?: Set<string>;
  className?: string;
}

export function LocationSelect({ locations, value, onChange, placeholder = "No location", exclude, className }: LocationSelectProps) {
  const options = useMemo(() => flattenTree(buildLocationTree(locations)).filter((l) => !exclude?.has(l.id)), [locations, exclude]);
  return (
    <select
      className={cn("border-input bg-background focus:border-ring focus:ring-ring/50 h-9 w-full rounded-md border px-2 text-sm shadow-xs focus:outline-none", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((l) => (
        <option key={l.id} value={l.id}>
          {`${"\u2003".repeat(l.depth)}${l.title || "Untitled"}${l.kind ? ` · ${l.kind}` : ""}`}
        </option>
      ))}
    </select>
  );
}
