import { cn } from "@twodb/blocks";
import { ScanLine } from "lucide-react";
import { Link } from "../../lib/router";
import { NAV } from "../nav";

/** Mobile: 4 tabs with a raised Scan button in the middle. */
export function BottomNav({ section, onScan }: { section: string; onScan: () => void }) {
  const tabs = NAV.filter((n) => n.mobile);
  const tab = (n: (typeof tabs)[number]) => (
    <Link key={n.id} to={n.to} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", section === n.id ? "text-ink" : "text-muted-foreground")}>
      <n.icon className={cn("size-5", section === n.id && "scale-110")} />
      {n.label}
    </Link>
  );
  return (
    <nav className="tt-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-outline bg-card/95 backdrop-blur md:hidden">
      <div className="flex items-end">
        {tabs.slice(0, 2).map(tab)}
        <div className="flex flex-1 justify-center">
          <button onClick={onScan} aria-label="Scan" className="-mt-6 grid size-16 place-items-center rounded-full border-4 border-paper bg-ink text-paper shadow-xl active:scale-95">
            <ScanLine className="size-7" />
          </button>
        </div>
        {tabs.slice(2, 4).map(tab)}
      </div>
    </nav>
  );
}
