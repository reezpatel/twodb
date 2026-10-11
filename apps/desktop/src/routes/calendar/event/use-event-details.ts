import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { calendarKeys, eventPath, type EventDetail, type Occurrence, type RecurrenceScope } from "../calendar-api";

export function useEventDetails(occurrence: Occurrence, onChanged: () => void) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: calendarKeys.event(occurrence.eventId), queryFn: () => api<EventDetail>(`/api/calendar/events/${occurrence.eventId}`) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: calendarKeys.event(occurrence.eventId) });
    onChanged();
  };

  const rsvp = useMutation({
    mutationFn: ({ status, scope }: { status: "accepted" | "declined" | "tentative"; scope: RecurrenceScope }) =>
      api(
        `/api/calendar/events/${occurrence.eventId}/rsvp?${new URLSearchParams({ scope, ...(occurrence.isRecurring ? { occurrence: occurrence.originalStart ?? occurrence.startAt } : {}) })}`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
        },
      ),
    onSuccess: refresh,
  });
  const pushNow = useMutation({
    mutationFn: () => api(`/api/calendar/events/${occurrence.eventId}/push-now`, { method: "POST", body: "{}" }),
    onSuccess: refresh,
  });
  const discardLocal = useMutation({
    mutationFn: () => api(`/api/calendar/events/${occurrence.eventId}/discard-local`, { method: "POST", body: "{}" }),
    onSuccess: refresh,
  });
  const duplicate = useMutation({
    mutationFn: () => api<{ id: string }>(`/api/calendar/events/${occurrence.eventId}/duplicate`, { method: "POST", body: "{}" }),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: () => api(`/api/calendar/events/${occurrence.eventId}/restore`, { method: "POST", body: "{}" }),
    onSuccess: refresh,
  });

  const descriptionHtml = useMemo(() => {
    const html = detail.data?.event.descriptionHtml;
    if (!html) return null;
    return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["a", "b", "strong", "i", "em", "u", "br", "p", "ul", "ol", "li", "span", "div"], ALLOWED_ATTR: ["href"] });
  }, [detail.data?.event.descriptionHtml]);

  const self = detail.data?.attendees.find((a) => a.isSelf) ?? null;
  const isOrganizer = !detail.data?.event.organizer || detail.data.selfAddresses.includes(detail.data.event.organizer.email.toLowerCase());
  const pinnedFields = Object.keys(detail.data?.event.localOnlyFields ?? {});

  return {
    detail,
    descriptionHtml,
    self,
    isOrganizer,
    pinnedFields,
    rsvp,
    pushNow,
    discardLocal,
    duplicate,
    restore,
    exportUrl: eventPath(occurrence.eventId).replace(/\?.*/, "") + "/export.ics",
  };
}
