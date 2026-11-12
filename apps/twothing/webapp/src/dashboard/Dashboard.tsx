import { Boxes, CircleDollarSign, MapPinOff, Package, PackageMinus, PackagePlus, QrCode, ScanLine, Star, TriangleAlert, Warehouse, Waypoints } from "lucide-react";
import { formatMoney, formatQty } from "../lib/format";
import { Link, navigate } from "../lib/router";
import { ItemRow } from "../items/partials/ItemRow";
import { ActivityList } from "../ui/ActivityList";
import { ItemThumb } from "../ui/ItemThumb";
import { Page, Section, Spinner } from "../ui/Page";
import { useDashboard } from "./hooks/useDashboard";
import { CategoryBars } from "./partials/CategoryBars";
import { Onboarding } from "./partials/Onboarding";
import { StatTile } from "./partials/StatTile";

export function Dashboard() {
  const h = useDashboard();
  const s = h.stats;
  if (h.loading || !s) return <Spinner />;
  const t = s.totals;

  return (
    <Page wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-ink-muted">{h.greeting} 👋</div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your stuff</h1>
        </div>
      </div>

      {/* quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <button onClick={h.scan} className="group relative col-span-2 flex items-center gap-4 overflow-hidden rounded-[22px] bg-ink p-5 text-left text-paper shadow-lg transition hover:shadow-xl active:scale-[0.99] md:col-span-1 md:flex-col md:items-start">
          <span className="grid size-12 place-items-center rounded-2xl bg-paper/10">
            <ScanLine className="size-6 transition group-hover:scale-110" />
          </span>
          <span>
            <span className="block text-lg font-bold">Scan</span>
            <span className="block text-sm text-paper/60">Labels, boxes, product barcodes</span>
          </span>
          <span className="pointer-events-none absolute -right-6 -bottom-6 size-28 rounded-full bg-paper/5" />
        </button>
        {[
          { icon: PackagePlus, title: "Add item", sub: "Label it & stash it", run: () => navigate("/items/new") },
          { icon: Waypoints, title: "Put away", sub: "Scan box, then things", run: h.putAway },
          { icon: PackageMinus, title: "Use up", sub: "Scan to take −1", run: h.stockOut },
        ].map((a) => (
          <button key={a.title} onClick={a.run} className="flex items-center gap-3 rounded-[22px] border border-outline bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-md md:flex-col md:items-start md:p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-stone">
              <a.icon className="size-5" />
            </span>
            <span>
              <span className="block font-semibold">{a.title}</span>
              <span className="block text-xs text-ink-muted">{a.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {h.fresh ? (
        <Onboarding />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile icon={Package} label="items" value={formatQty(t.items)} to="/items" />
            <StatTile icon={Boxes} label="units in stock" value={formatQty(Math.round(t.units))} />
            <StatTile icon={Warehouse} label="places" value={formatQty(t.locations)} to="/places" />
            <StatTile icon={CircleDollarSign} label="est. value" value={t.value ? formatMoney(t.value) : "—"} />
            <StatTile icon={TriangleAlert} label="low stock" value={String(t.low)} to="/items?low=1" tone={t.low ? "danger" : undefined} />
            <StatTile icon={MapPinOff} label={`unplaced · ${t.unlabeled} unlabeled`} value={String(t.unplaced)} to="/items?unplaced=1" tone={t.unplaced ? "warn" : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {s.lowStock.length > 0 && (
                <Section title={<span className="inline-flex items-center gap-1.5 text-destructive"><TriangleAlert className="size-3.5" /> Running low</span>} action={<Link to="/items?low=1" className="text-xs font-semibold text-ink-muted hover:text-ink">All →</Link>}>
                  <div className="-mx-2 divide-y divide-outline">
                    {s.lowStock.map((it) => (
                      <ItemRow key={it.id} item={it} onOpen={() => navigate(`/items/${it.id}`)} onDelta={(d) => h.onDelta(it, d)} />
                    ))}
                  </div>
                </Section>
              )}
              <Section title="Recently added" action={<Link to="/items?sort=created" className="text-xs font-semibold text-ink-muted hover:text-ink">All →</Link>}>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {s.recent.map((it) => (
                    <Link key={it.id} to={`/items/${it.id}`} className="w-36 shrink-0 rounded-2xl border border-outline bg-paper p-2 transition hover:-translate-y-0.5 hover:shadow-md">
                      <ItemThumb imageId={it.imageIds[0]} category={it.category} className="aspect-square size-auto w-full rounded-xl" iconClassName="size-9" />
                      <div className="mt-2 line-clamp-2 text-sm leading-tight font-medium">{it.name}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">
                        {formatQty(it.quantity)} {it.unit}
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
              {s.favorites.length > 0 && (
                <Section title={<span className="inline-flex items-center gap-1.5"><Star className="size-3.5 text-amber-500" /> Starred</span>}>
                  <div className="-mx-2 divide-y divide-outline">
                    {s.favorites.map((it) => (
                      <ItemRow key={it.id} item={it} onOpen={() => navigate(`/items/${it.id}`)} onDelta={(d) => h.onDelta(it, d)} />
                    ))}
                  </div>
                </Section>
              )}
            </div>
            <div className="space-y-4">
              <Section title="By category">
                <CategoryBars categories={s.categories} />
              </Section>
              <Section title="Activity" action={<Link to="/activity" className="text-xs font-semibold text-ink-muted hover:text-ink">All →</Link>}>
                <ActivityList entries={s.activity} showTarget />
              </Section>
              <Link to="/labels" className="flex items-center gap-3 rounded-[18px] border border-dashed border-outline p-4 text-sm hover:border-ink/30">
                <QrCode className="size-5" />
                <span className="flex-1">
                  <b>Running out of stickers?</b>
                  <br />
                  <span className="text-ink-muted">Generate a fresh batch of labels.</span>
                </span>
              </Link>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
