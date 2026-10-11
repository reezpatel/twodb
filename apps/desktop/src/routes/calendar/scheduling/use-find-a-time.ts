import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { addDays, fromWall } from "../calendar-api";

export interface FreeBusy {
  busy: { start: string; end: string }[];
  source: "twodb" | "provider" | "unavailable";
}

/** Availability for the guests on the chosen day plus suggested slots over the next week. */
export function useFindATime(opts: { calendarId: string; attendees: string[]; durationMin: number; day: string; tz: string; enabled: boolean }) {
  const from = fromWall(opts.day, 0, opts.tz).toISOString();
  const to = fromWall(addDays(opts.day, 7), 0, opts.tz).toISOString();
  return useQuery({
    queryKey: ["calendar", "find-a-time", opts.calendarId, opts.attendees.join(","), opts.durationMin, opts.day],
    queryFn: () =>
      api<{ busy: Record<string, FreeBusy>; slots: { start: string; end: string }[] }>("/api/calendar/suggest-times", {
        method: "POST",
        body: JSON.stringify({ calendarId: opts.calendarId, attendees: opts.attendees, durationMin: opts.durationMin, from, to }),
      }),
    enabled: opts.enabled && !!opts.calendarId,
    retry: false,
  });
}
