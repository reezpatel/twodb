import { Suspense } from "react";
import { ArrowLeft, LayoutGrid, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SHOWCASE_GROUPS } from "./showcase-items";
import { useShowcaseScene } from "./use-showcase-scene";

function StageFallback() {
  return (
    <div className="flex flex-col gap-4 p-10">
      <Skeleton className="mx-auto h-8 w-64" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function ShowcaseScene() {
  const showcase = useShowcaseScene();

  if (showcase.active) {
    const Mock = showcase.active.Component;
    return (
      <div className="bg-background flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => showcase.setActiveId(null)}>
            <ArrowLeft size={14} /> Gallery
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{showcase.active.title}</h2>
          </div>
          <span className="text-muted-foreground/70 ml-auto text-[11px] font-semibold tracking-wider uppercase">{showcase.active.group}</span>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-5xl p-8">
            <Suspense fallback={<StageFallback />}>
              <Mock />
            </Suspense>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="bg-background h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <header className="flex flex-wrap items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-lg">
            <LayoutGrid size={18} />
          </span>
          <div>
            <h2 className="text-lg leading-tight font-semibold">Showcase</h2>
            <p className="text-muted-foreground text-xs">Design reference scenes from the ui-library, ported to the app theme</p>
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
            <Input
              value={showcase.query}
              onChange={(e) => showcase.setQuery(e.target.value)}
              placeholder="Search showcases…"
              aria-label="Search showcases"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
        </header>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              !showcase.group ? "border-primary/40 bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50",
            )}
            onClick={() => showcase.setGroup(null)}
          >
            All
          </button>
          {SHOWCASE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                showcase.group === g ? "border-primary/40 bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50",
              )}
              onClick={() => showcase.setGroup(showcase.group === g ? null : g)}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {showcase.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="hover:border-primary/40 hover:bg-accent/30 group flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors"
              onClick={() => showcase.setActiveId(item.id)}
            >
              <span className="bg-muted/60 text-muted-foreground grid h-20 place-items-center rounded-lg transition-colors group-hover:text-primary">
                <Sparkles size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{item.group}</span>
              </span>
            </button>
          ))}
          {showcase.items.length === 0 ? <p className="text-muted-foreground col-span-full py-10 text-center text-sm">No showcases match.</p> : null}
        </div>
      </div>
    </div>
  );
}
