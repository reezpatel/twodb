import { cn } from "@twodb/blocks";
import { PackageMinus, PackagePlus, QrCode, ScanLine, Warehouse, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import { categoryOf } from "../lib/catalog";
import { formatMoney, formatQty } from "../lib/format";
import { Link, navigate } from "../lib/router";
import { ItemsTable } from "../items/partials/ItemsTable";
import { toTimelineItems } from "../ui/ActivityList";
import { Page, PageHeader, Spinner, cbtn } from "../ui/Page";
import { Timeline } from "../ui/Timeline";
import { useDashboard } from "./hooks/useDashboard";

const heading = "text-[11px] font-semibold tracking-wider text-ink-muted uppercase";

function Stat({ label, value, to, tone }: { label: string; value: string; to?: string; tone?: "danger" | "warn" }) {
  const body = (
    <>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-[15px] tabular-nums", tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-600" : "text-ink")}>
        {value}
      </dd>
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-[6px] transition hover:opacity-70">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

function Block({ title, to, children, card }: { title: ReactNode; to?: string; children: ReactNode; card?: boolean }) {
  return (
    <section className={cn("space-y-3", card && "rounded-[6px] border border-outline bg-card p-4")}>
      <div className="flex items-center gap-2">
        <h2 className={heading}>{title}</h2>
        {to && (
          <Link to={to} className="ml-auto text-[12px] text-ink-muted hover:text-ink">
            View all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

const STEPS = [
  { icon: QrCode, title: "Print a stack of labels", body: "Random, unique QR codes on sticker sheets or a label roll.", to: "/labels", cta: "Generate labels" },
  {
    icon: Warehouse,
    title: "Label your boxes & drawers",
    body: "Create places (Workshop › Shelf › SMD box) and put a sticker on each.",
    to: "/places/new",
    cta: "Add a place",
  },
  {
    icon: PackagePlus,
    title: "Add things",
    body: "Stick a label, scan it, scan the box. Or scan the product's own barcode.",
    to: "/items/new",
    cta: "Add an item",
  },
];

export function Dashboard() {
  const h = useDashboard();
  const s = h.stats;
  if (h.loading || !s) return <Spinner />;
  const t = s.totals;
  const openItem = (it: { id: string }) => navigate(`/items/${it.id}`);

  return (
    <Page>
      <PageHeader
        title="Home"
        actions={
          <>
            <button className={cbtn.secondary} onClick={h.putAway}>
              <Waypoints className="size-3.5" /> Put away
            </button>
            <button className={cbtn.secondary} onClick={h.stockOut}>
              <PackageMinus className="size-3.5" /> Use up
            </button>
            <button className={cbtn.primary} onClick={h.scan}>
              <ScanLine className="size-3.5" /> Scan
            </button>
          </>
        }
        eyebrow={
          h.fresh ? undefined : (
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              <Stat label="Items" value={formatQty(t.items)} to="/items" />
              <Stat label="Units in stock" value={formatQty(Math.round(t.units))} />
              <Stat label="Places" value={formatQty(t.locations)} to="/places" />
              <Stat label="Est. value" value={t.value ? formatMoney(t.value) : "—"} />
              <Stat label="Low stock" value={String(t.low)} to="/items?low=1" tone={t.low ? "danger" : undefined} />
              <Stat label={`Unplaced · ${t.unlabeled} unlabeled`} value={String(t.unplaced)} to="/items?unplaced=1" tone={t.unplaced ? "warn" : undefined} />
            </dl>
          )
        }
      />

      {h.fresh ? (
        <ol className="grid gap-x-8 gap-y-6 md:grid-cols-3">
          {STEPS.map((st, i) => (
            <li key={st.title} className="space-y-2">
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <span className="grid size-5 place-items-center rounded-full border border-ink/25 text-[11px] text-ink-muted">{i + 1}</span>
                {st.title}
              </div>
              <p className="text-[12px] font-light text-ink-muted">{st.body}</p>
              <Link to={st.to} className={cbtn.secondary}>
                <st.icon className="size-3.5" /> {st.cta}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="space-y-10">
          <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-10">
              {s.lowStock.length > 0 && (
                <Block title="Running low" to="/items?low=1">
                  <ItemsTable items={s.lowStock} onOpen={openItem} showPlace={false} />
                </Block>
              )}
              <Block title="Recently added" to="/items?sort=created">
                <ItemsTable items={s.recent} onOpen={openItem} showPlace={false} />
              </Block>
              {s.favorites.length > 0 && (
                <Block title="Starred" to="/items?favorite=1">
                  <ItemsTable items={s.favorites} onOpen={openItem} showPlace={false} />
                </Block>
              )}
            </div>

            <div className="min-w-0 space-y-8 rounded-[6px] border border-outline bg-card p-4 lg:self-start">
              <Block title="By category">
                {s.categories.length === 0 ? (
                  <p className="text-[13px] font-light text-ink-muted">No items yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {s.categories.map((c) => {
                      const cat = categoryOf(c.category);
                      return (
                        <li key={c.category}>
                          <Link
                            to={`/items?category=${c.category}`}
                            className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-[13px] transition hover:bg-stone"
                          >
                            <cat.icon className="size-3.5 shrink-0" style={{ color: cat.color }} />
                            <span className="flex-1 truncate">{cat.short}</span>
                            <span className="text-ink-muted tabular-nums">{c.n}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Block>
              {s.activity.length > 0 && (
                <Block title="Activity" to="/activity">
                  <Timeline
                    size="sm"
                    relativeTime
                    gapClassName="pb-6"
                    secondaryClassName="text-[11px]"
                    items={toTimelineItems(s.activity.slice(0, 8), { icons: false })}
                  />
                </Block>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
