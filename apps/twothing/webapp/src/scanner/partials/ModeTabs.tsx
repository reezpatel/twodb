import { cn } from "@twodb/blocks";
import { PackageMinus, PackagePlus, ScanSearch, Waypoints } from "lucide-react";
import type { ScanMode } from "../ScanContext";

const MODES: { id: ScanMode; label: string; icon: typeof ScanSearch }[] = [
  { id: "lookup", label: "Find", icon: ScanSearch },
  { id: "putaway", label: "Put away", icon: Waypoints },
  { id: "stockIn", label: "+1 In", icon: PackagePlus },
  { id: "stockOut", label: "−1 Out", icon: PackageMinus },
];

export function ModeTabs({ mode, onChange }: { mode: ScanMode; onChange: (m: ScanMode) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-white/10 p-1 backdrop-blur">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition",
            mode === m.id ? "bg-white text-black shadow" : "text-white/75 hover:text-white",
          )}
        >
          <m.icon className="size-3.5" />
          {m.label}
        </button>
      ))}
    </div>
  );
}
