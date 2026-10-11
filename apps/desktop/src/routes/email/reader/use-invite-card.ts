import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Invite {
  method: string;
  result: string | null;
  uid: string;
  eventId: string | null;
  calendarId: string | null;
  selfStatus: string | null;
  summary: {
    title: string;
    location: string | null;
    isAllDay: boolean;
    startAt: string | null;
    endAt: string | null;
    startDate: string | null;
    endDate: string | null;
    organizer: { email: string; name?: string | null } | null;
    attendeeCount: number;
    recurring: boolean;
    conference: { url: string | null } | null;
  } | null;
}

export function useInviteCard(messageId: string) {
  const queryClient = useQueryClient();
  const invite = useQuery({
    queryKey: ["calendar", "invite", messageId],
    queryFn: () => api<Invite | null>(`/api/calendar/invites/${messageId}`),
    staleTime: 60_000,
  });
  const respond = useMutation({
    mutationFn: (status: "accepted" | "tentative" | "declined") =>
      api(`/api/calendar/invites/${messageId}/respond`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", "invite", messageId] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", "occurrences"] });
    },
  });
  return { invite, respond };
}
