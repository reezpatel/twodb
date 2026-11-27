import { useState } from "react";
import { api } from "../lib/api";
import { useQuery } from "../lib/query";
import type { Activity } from "../lib/types";
import { toTimelineItems } from "../ui/ActivityList";
import { Page, PageHeader, btn } from "../ui/Page";
import { Timeline } from "../ui/Timeline";

const dayLabel = (d: Date) => {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
};

/** Entries arrive newest-first, so consecutive entries on the same local day form one group. */
function groupByDay(entries: Activity[]) {
  const groups: { key: string; label: string; entries: Activity[] }[] = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const key = d.toDateString();
    const last = groups[groups.length - 1];
    if (last?.key === key) last.entries.push(e);
    else groups.push({ key, label: dayLabel(d), entries: [e] });
  }
  return groups;
}

/** Full activity log with cursor paging. */
export function ActivityPage() {
  const first = useQuery("activity", () => api.activity({ limit: 60 }));
  const [more, setMore] = useState<Activity[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const all = [...(first.data?.entries ?? []), ...more];

  const loadMore = async () => {
    const last = all[all.length - 1];
    if (!last) return;
    setBusy(true);
    const res = await api.activity({ limit: 60, before: last.id });
    setMore((m) => [...m, ...res.entries]);
    if (res.entries.length < 60) setDone(true);
    setBusy(false);
  };

  return (
    <Page>
      <PageHeader title="Activity" subtitle="Every add, move, stock change and label — newest first." />
      {first.loading ? (
        <Timeline items={[]} loading loadingItemsCount={6} size="sm" />
      ) : all.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-muted">Nothing has happened yet.</div>
      ) : (
        <div className="space-y-8">
          {groupByDay(all).map((g) => (
            <section key={g.key} className="grid gap-x-8 gap-y-3 md:grid-cols-[9rem_1fr]">
              <h2 className="text-[12px] font-medium text-ink-muted md:sticky md:top-0 md:self-start md:pt-0.5">{g.label}</h2>
              <Timeline size="sm" items={toTimelineItems(g.entries, { icons: false })} timeFormat={{ timeStyle: "short" }} />
            </section>
          ))}
        </div>
      )}
      {all.length >= 60 && !done && (
        <div className="mt-8 flex justify-center">
          <button className={btn.secondary} disabled={busy} onClick={() => void loadMore()}>
            {busy ? "Loading…" : "Load older"}
          </button>
        </div>
      )}
    </Page>
  );
}
