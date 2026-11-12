import { useState } from "react";
import { api } from "../lib/api";
import { useQuery } from "../lib/query";
import type { Activity } from "../lib/types";
import { ActivityList } from "../ui/ActivityList";
import { Page, PageHeader, Spinner, btn } from "../ui/Page";

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
    <Page className="max-w-3xl">
      <PageHeader title="Activity" subtitle="Every add, move, stock change and label — newest first." />
      {first.loading ? (
        <Spinner />
      ) : (
        <div className="rounded-[18px] border border-outline bg-card p-2 md:p-3">
          <ActivityList entries={all} showTarget empty="Nothing has happened yet." />
          {all.length >= 60 && !done && (
            <div className="flex justify-center p-2">
              <button className={btn.secondary} disabled={busy} onClick={() => void loadMore()}>
                {busy ? "Loading…" : "Load older"}
              </button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
