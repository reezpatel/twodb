import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { api } from "@/lib/api";
import { calendarKeys, useCalendarMeta, useCalendars, useCalendarSettings, type CalendarItem, type CalendarSettings } from "../../calendar/calendar-api";
import { uploadForm } from "../../email/email-api";

export interface CalendarShare {
  id: string;
  principalType: "user" | "org" | "email";
  principal: string;
  role: string;
  name: string | null;
  email: string | null;
}

export function useCalendarSettingsSection() {
  const queryClient = useQueryClient();
  const settings = useCalendarSettings();
  const calendars = useCalendars();
  const meta = useCalendarMeta();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: calendarKeys.all });

  const saveSettings = useMutation({
    mutationFn: (patch: Partial<CalendarSettings>) => api<CalendarSettings>("/api/calendar/settings", { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: (next) => queryClient.setQueryData(calendarKeys.settings, next),
  });
  const updateCalendar = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api(`/api/calendar/calendars/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });
  const createCalendar = useMutation({
    mutationFn: (body: { name: string; color?: string; subscriptionUrl?: string; timezone?: string }) =>
      api<{ id: string }>("/api/calendar/calendars", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
  const deleteCalendar = useMutation({ mutationFn: (id: string) => api(`/api/calendar/calendars/${id}`, { method: "DELETE" }), onSuccess: invalidate });
  const syncCalendar = useMutation({
    mutationFn: (id: string) => api(`/api/calendar/calendars/${id}/sync`, { method: "POST", body: "{}" }),
    onSuccess: invalidate,
  });
  const feed = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api<{ url: string | null }>(`/api/calendar/calendars/${id}/feed`, { method: "POST", body: JSON.stringify({ enabled }) }),
    onSuccess: invalidate,
  });
  const importIcs = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return uploadForm<{ imported: number }>(`/api/calendar/calendars/${id}/import`, form);
    },
    onSuccess: invalidate,
  });

  return { settings, calendars, meta, saveSettings, updateCalendar, createCalendar, deleteCalendar, syncCalendar, feed, importIcs };
}

export function useGeneralForm(settings: CalendarSettings, onSave: (v: Partial<CalendarSettings>) => Promise<unknown>) {
  return useForm({
    defaultValues: settings,
    onSubmit: async ({ value }) => {
      await onSave(value);
    },
  });
}

export function useCalendarShares(calendar: CalendarItem | null) {
  const queryClient = useQueryClient();
  const id = calendar?.id ?? "";
  const shares = useQuery({
    queryKey: ["calendar", "shares", id],
    queryFn: () => api<CalendarShare[]>(`/api/calendar/calendars/${id}/shares`),
    enabled: !!calendar && !calendar.accountId,
  });
  const orgUsers = useQuery({
    queryKey: ["email", "org-users"],
    queryFn: () => api<{ id: string; name: string; email: string }[]>("/api/email/org-users"),
    enabled: !!calendar,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["calendar", "shares", id] });
  const setShare = useMutation({
    mutationFn: (body: { principalType: "user" | "org"; principal?: string; role: string }) =>
      api(`/api/calendar/calendars/${id}/shares`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
  const removeShare = useMutation({
    mutationFn: (shareId: string) => api(`/api/calendar/calendars/${id}/shares/${shareId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return { shares, orgUsers, setShare, removeShare };
}
