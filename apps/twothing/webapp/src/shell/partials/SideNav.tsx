import { cn } from "@twodb/blocks";
import { Plus, ScanLine } from "lucide-react";
import { CATEGORIES } from "../../lib/catalog";
import { Link } from "../../lib/router";
import { NAV } from "../nav";
import { Logo } from "./Logo";

export function SideNav({ section, onScan, activeCategory }: { section: string; onScan: () => void; activeCategory: string | null }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-outline bg-card md:flex">
      <div className="px-5 pt-5 pb-4">
        <Logo />
      </div>
      <div className="flex gap-2 px-3">
        <button onClick={onScan} className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink py-2.5 font-semibold text-paper shadow-sm transition hover:bg-ink/90 active:scale-[0.98]">
          <ScanLine className="size-4 transition group-hover:scale-110" /> Scan
          <kbd className="ml-1 rounded border border-paper/25 px-1 font-mono text-[10px] text-paper/60">S</kbd>
        </button>
        <Link to="/items/new" title="Add item (N)" className="grid size-[42px] place-items-center rounded-2xl border border-outline bg-paper hover:bg-stone">
          <Plus className="size-4" />
        </Link>
      </div>
      <nav className="mt-4 space-y-0.5 px-3">
        {NAV.map((n) => (
          <Link
            key={n.id}
            to={n.to}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium text-muted-foreground transition hover:bg-stone hover:text-ink",
              section === n.id && !activeCategory && "bg-paper text-ink shadow-[0_0_0_1px_var(--outline)]",
            )}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 px-6 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Categories</div>
      <nav className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            to={`/items?category=${c.id}`}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-stone hover:text-ink",
              activeCategory === c.id && "bg-paper text-ink shadow-[0_0_0_1px_var(--outline)]",
            )}
          >
            <span className="grid size-6 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${c.color} 16%, transparent)`, color: c.color }}>
              <c.icon className="size-3.5" />
            </span>
            {c.short}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
