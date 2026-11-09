import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { calendarKeys, formatRange, type CalendarItem } from "../calendar-api";

interface TrashRow {
  id: string;
  calendarId: string;
  title: string;
  isAllDay: boolean;
  startAt: string | null;
  startDate: string | null;
  deletedAt: string;
  pushState: string;
}

function useTrash() {
  const queryClient = useQueryClient();
  const trash = useQuery({ queryKey: calendarKeys.trash, queryFn: () => api<TrashRow[]>("/api/calendar/trash") });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["calendar"] });
  const restore = useMutation({ mutationFn: (id: string) => api(`/api/calendar/events/${id}/restore`, { method: "POST", body: "{}" }), onSuccess: refresh });
  const purge = useMutation({
    mutationFn: (ids: string[] | "all") =>
      api<{ purged: number }>("/api/calendar/trash", { method: "DELETE", body: JSON.stringify(ids === "all" ? {} : { ids }) }),
    onSuccess: refresh,
  });
  return { trash, restore, purge };
}

export function TrashPanel({ tz, calendars }: { tz: string; calendars: Map<string, CalendarItem> }) {
  const t = useTrash();
  const rows = t.trash.data ?? [];
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
      <header className="flex items-center gap-2">
        <Trash2 size={18} />
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Trash</h2>
          <p className="text-muted-foreground text-xs">
            Deleted events stay here for 30 days. Events whose delete still waits for approval can't be emptied yet.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive ml-auto"
          disabled={!rows.length || t.purge.isPending}
          onClick={() => window.confirm("Permanently delete everything in Trash?") && t.purge.mutate("all")}
        >
          Empty trash
        </Button>
      </header>
      {t.trash.isLoading ? <Loader2 className="text-muted-foreground animate-spin" /> : null}
      {!t.trash.isLoading && !rows.length ? <p className="text-muted-foreground text-sm">Trash is empty.</p> : null}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: calendars.get(r.calendarId)?.color }} />
          <span className="flex min-w-0 flex-1 flex-col">
            <strong className="truncate text-sm font-medium">{r.title || "(no title)"}</strong>
            <span className="text-muted-foreground text-xs">
              {formatRange({ isAllDay: r.isAllDay, startAt: r.startAt, endAt: r.startAt, startDate: r.startDate, endDate: null }, tz)} ·{" "}
              {calendars.get(r.calendarId)?.name}
              {r.pushState === "awaiting_approval" ? " · delete waiting for approval" : ""}
            </span>
          </span>
          <Button size="sm" variant="outline" disabled={t.restore.isPending} onClick={() => t.restore.mutate(r.id)}>
            <RotateCcw /> Restore
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete forever" onClick={() => t.purge.mutate([r.id])}>
            <Trash2 />
          </Button>
        </div>
      ))}
    </section>
  );
}
