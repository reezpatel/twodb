import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { get, qs } from "./api";
import type * as T from "./types";

/** Every TwoPlan query key starts with "tp" so one invalidation refreshes derived data (counts, progress). */
export const K = {
  projects: (spaceId?: string) => ["tp", "projects", spaceId ?? "all"] as const,
  project: (key: string) => ["tp", "project", key] as const,
  config: (key: string) => ["tp", "config", key] as const,
  tickets: (key: string, params: unknown) => ["tp", "tickets", key, params] as const,
  ticket: (ident: string) => ["tp", "ticket", ident] as const,
  activity: (ident: string) => ["tp", "activity", ident] as const,
  list: (key: string, what: string) => ["tp", what, key] as const,
};

const reg = async <R,>(path: string): Promise<R> => {
  const r = await fetch(path, { credentials: "include" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

export const useSpaces = () => useQuery({ queryKey: ["tp", "spaces"], queryFn: () => reg<{ spaces: { id: string; name: string }[] }>("/registry/spaces").then((r) => r.spaces), staleTime: 60_000 });
export const useMembersQuery = () => useQuery({ queryKey: ["tp", "members"], queryFn: () => reg<{ members: T.Member[]; me: string | null }>("/registry/members"), staleTime: 60_000 });

export const useProjects = (spaceId?: string) => useQuery({ queryKey: K.projects(spaceId), queryFn: () => get<T.Project[]>(`/projects${qs({ spaceId })}`) });
export const useProject = (key: string) => useQuery({ queryKey: K.project(key), queryFn: () => get<T.Project>(`/projects/${key}`) });
export const useConfig = (key: string) => useQuery({ queryKey: K.config(key), queryFn: () => get<T.ProjectConfig>(`/projects/${key}/config`) });

export interface TicketQuery extends T.TicketFilters { sort?: string; dir?: "asc" | "desc"; limit?: number }
export const useTickets = (key: string, q: TicketQuery) =>
  useQuery({ queryKey: K.tickets(key, q), queryFn: () => get<{ items: T.Ticket[]; total: number }>(`/projects/${key}/tickets${qs({ ...q, limit: q.limit ?? 1000 })}`), placeholderData: keepPreviousData });
export const useTicket = (ident: string) => useQuery({ queryKey: K.ticket(ident), queryFn: () => get<T.TicketDetail>(`/tickets/${ident}`) });
export const useActivity = (ident: string) => useQuery({ queryKey: K.activity(ident), queryFn: () => get<T.Activity[]>(`/tickets/${ident}/activity`) });

export const useEpics = (key: string) => useQuery({ queryKey: K.list(key, "epics"), queryFn: () => get<T.Epic[]>(`/projects/${key}/epics`) });
export const useMilestones = (key: string) => useQuery({ queryKey: K.list(key, "milestones"), queryFn: () => get<T.Milestone[]>(`/projects/${key}/milestones`) });
export const useViews = (key: string) => useQuery({ queryKey: K.list(key, "views"), queryFn: () => get<T.SavedView[]>(`/projects/${key}/views`) });
export const useDocs = (key: string) => useQuery({ queryKey: K.list(key, "docs"), queryFn: () => get<T.Doc[]>(`/projects/${key}/documents`) });
export const useDashboards = (key: string) => useQuery({ queryKey: K.list(key, "dashboards"), queryFn: () => get<T.Dashboard[]>(`/projects/${key}/dashboards`) });
export const useTicketTemplates = (key: string) => useQuery({ queryKey: K.list(key, "tpl"), queryFn: () => get<T.TicketTemplate[]>(`/projects/${key}/ticket-templates`) });
export const useStats = (key: string) => useQuery({ queryKey: K.list(key, "stats"), queryFn: () => get<any>(`/projects/${key}/stats`) });
export const useTimeline = (key: string) => useQuery({ queryKey: K.list(key, "timeline"), queryFn: () => get<{ epics: any[]; milestones: any[]; tickets: any[] }>(`/projects/${key}/timeline`) });
export const useShareLinks = (key: string) => useQuery({ queryKey: K.list(key, "share"), queryFn: () => get<any[]>(`/projects/${key}/share`) });
export const useProjectTemplates = () => useQuery({ queryKey: ["tp", "ptemplates"], queryFn: () => get<any[]>(`/project-templates`) });
export const useNotifications = () => useQuery({ queryKey: ["tp", "notifications"], queryFn: () => get<{ items: T.Notification[]; unreadCount: number }>(`/notifications`), refetchInterval: 60_000 });
export const useMyTickets = (scope: string) => useQuery({ queryKey: ["tp", "my", scope], queryFn: () => get<any[]>(`/my/tickets${qs({ scope })}`) });
export const useSearch = (q: string) => useQuery({ queryKey: ["tp", "search", q], queryFn: () => get<{ projects: any[]; tickets: any[]; epics: any[] }>(`/search${qs({ q })}`), enabled: q.trim().length > 0 });

/** Mutation that refreshes all TwoPlan data on success; callers can pass an optimistic `onMutate`. */
export function useApiMutation<V, R = unknown>(fn: (v: V) => Promise<R>, opts?: { onSuccess?: (r: R, v: V) => void; invalidate?: boolean }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => { if (opts?.invalidate !== false) void qc.invalidateQueries({ queryKey: ["tp"] }); opts?.onSuccess?.(r, v); },
  });
}
