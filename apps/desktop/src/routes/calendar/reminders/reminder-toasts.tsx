import { Bell, Video, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { ReminderEvent } from "../calendar-api";

function useReminderActions(onDone: (id: string) => void) {
  const snooze = useMutation({
    mutationFn: (id: string) => api(`/api/calendar/reminders/${id}/snooze`, { method: "POST", body: JSON.stringify({ minutes: 5 }) }),
    onSuccess: (_d, id) => onDone(id),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => api(`/api/calendar/reminders/${id}/dismiss`, { method: "POST", body: "{}" }),
    onSuccess: (_d, id) => onDone(id),
  });
  return { snooze, dismiss };
}

export function ReminderToasts({
  reminders,
  onDone,
  onOpen,
}: {
  reminders: ReminderEvent[];
  onDone: (id: string) => void;
  onOpen: (r: ReminderEvent) => void;
}) {
  const a = useReminderActions(onDone);
  if (!reminders.length) return null;
  return (
    <div className="absolute right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      {reminders.map((r) => (
        <div key={r.deliveryId} role="alert" className="bg-popover text-popover-foreground flex flex-col gap-2 rounded-xl border p-3 shadow-xl">
          <div className="flex items-start gap-2">
            <Bell size={15} className="text-primary mt-0.5 shrink-0" />
            <button type="button" className="flex min-w-0 flex-1 flex-col text-left" onClick={() => onOpen(r)}>
              <strong className="truncate text-sm">{r.title}</strong>
              <span className="text-muted-foreground text-xs">
                {r.minutes ? `Starts in ${r.minutes} min` : "Starting now"} ·{" "}
                {new Date(r.occurrenceStart).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                {r.location ? ` · ${r.location}` : ""}
              </span>
            </button>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => a.dismiss.mutate(r.deliveryId)}>
              <X />
            </Button>
          </div>
          <div className="flex gap-1.5 pl-6">
            {r.conferenceUrl ? (
              <Button size="xs" asChild>
                <a href={r.conferenceUrl} target="_blank" rel="noreferrer">
                  <Video /> Join
                </a>
              </Button>
            ) : null}
            <Button size="xs" variant="outline" onClick={() => a.snooze.mutate(r.deliveryId)}>
              Snooze 5 min
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
