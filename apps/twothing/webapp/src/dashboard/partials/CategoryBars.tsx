import { categoryOf } from "../../lib/catalog";
import { Link } from "../../lib/router";

export function CategoryBars({ categories }: { categories: { category: string; n: number }[] }) {
  const max = Math.max(1, ...categories.map((c) => c.n));
  if (!categories.length) return <div className="py-6 text-center text-sm text-ink-muted">No items yet.</div>;
  return (
    <div className="space-y-2.5">
      {categories.map((c) => {
        const cat = categoryOf(c.category);
        return (
          <Link key={c.category} to={`/items?category=${c.category}`} className="group flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${cat.color} 15%, transparent)`, color: cat.color }}>
              <cat.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium group-hover:underline">{cat.short}</span>
                <span className="text-ink-muted tabular-nums">{c.n}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone">
                <div className="h-full rounded-full transition-all" style={{ width: `${(c.n / max) * 100}%`, background: cat.color }} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
