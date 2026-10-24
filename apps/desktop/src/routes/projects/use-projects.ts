import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Shared types for the projects app. Server shapes in routes/projects.ts.

export type StatusCategory = "backlog" | "todo" | "in_progress" | "done" | "canceled";
export type TicketType = "issue" | "epic" | "bug" | "task" | "feature" | "chore";
export type TicketPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  description: string;
  icon: string | null;
  color: string | null;
  externalSource: "linear" | "plane" | null;
  externalRef: Record<string, unknown> | null;
  lastSyncAt: string | null;
  nextTicketNumber: number;
  createdAt: string;
  updatedAt: string;
  ticketCount?: number;
}

export interface Subproject {
  id: string;
  projectId: string;
  name: string;
  description: string;
  position: number;
}

export interface Status {
  id: string;
  projectId: string;
  subprojectId: string | null;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
  editable: "yes" | "sync";
}

export interface Label {
  id: string;
  projectId: string;
  groupId: string | null;
  name: string;
  color: string;
  editable: "yes" | "sync";
}

export interface LabelGroup {
  id: string;
  projectId: string;
  name: string;
  position: number;
}

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  status: "open" | "closed";
  position: number;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: "planned" | "active" | "closed";
  completedPoints: number | null;
  createdAt: string;
}

export interface TicketSummary {
  id: string;
  identifier: string;
  number: number;
  projectId: string;
  subprojectId: string;
  title: string;
  type: TicketType;
  statusId: string;
  priority: TicketPriority;
  estimate: number | null;
  parentTicketId: string | null;
  epicId: string | null;
  sprintId: string | null;
  milestoneId: string | null;
  assigneeUserId: string | null;
  inBacklog: boolean;
  position: number;
  externalRef: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  labels: Label[];
  tags: Tag[];
  assignee: { id: string; name: string; image: string | null } | null;
  status: Status | null;
  blockedBy: string[];
}

export interface ChecklistItem {
  id: string;
  ticketId: string;
  parentItemId: string | null;
  text: string;
  done: boolean;
  position: number;
}

export interface TicketComment {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends Omit<TicketSummary, "blockedBy"> {
  description: string;
  comments: TicketComment[];
  checklist: ChecklistItem[];
  subtasks: { id: string; identifier: string; title: string; statusId: string; type: TicketType }[];
  blockedBy: { id: string; identifier: string; title: string }[];
  blocks: { id: string; identifier: string; title: string }[];
}

export interface ProjectDetail {
  project: Project;
  subprojects: Subproject[];
  statuses: Status[];
  labelGroups: LabelGroup[];
  labels: Label[];
  tags: Tag[];
  milestones: Milestone[];
  sprints: Sprint[];
  members: { userId: string; role: string; name: string; email: string; image: string | null }[];
  links: { linkedProjectId: string; linkedName: string; linkedKey: string }[];
  myRole: "owner" | "admin" | "member" | null;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ projects: Project[] }>("/api/projects/projects").then((r) => r.projects),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => api<ProjectDetail>(`/api/projects/projects/${projectId}`),
    enabled: !!projectId,
  });
}

export function useTickets(projectId: string | undefined, filter: { subprojectId?: string; sprintId?: string; backlog?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filter.subprojectId) params.set("subprojectId", filter.subprojectId);
  if (filter.sprintId) params.set("sprintId", filter.sprintId);
  if (filter.backlog) params.set("backlog", "true");
  const qs = params.toString();
  return useQuery({
    queryKey: ["projects", projectId, "tickets", filter],
    queryFn: () => api<{ tickets: TicketSummary[] }>(`/api/projects/projects/${projectId}/tickets${qs ? `?${qs}` : ""}`).then((r) => r.tickets),
    enabled: !!projectId,
  });
}

export function useTicket(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["tickets", ticketId],
    queryFn: () => api<{ ticket: TicketDetail }>(`/api/projects/tickets/${ticketId}`).then((r) => r.ticket),
    enabled: !!ticketId,
  });
}

export function useVelocity(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "velocity"],
    queryFn: () =>
      api<{ velocity: { sprint: Sprint; plannedPoints: number; completedPoints: number }[] }>(`/api/projects/projects/${projectId}/velocity`).then(
        (r) => r.velocity,
      ),
    enabled: !!projectId,
  });
}

/** Mutation helper: invalidates the project + ticket caches on success. */
export function useProjectMutation<TBody, TResult = unknown>(fn: (body: TBody) => Promise<TResult>, invalidate: (string | undefined)[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of invalidate) {
        void queryClient.invalidateQueries({ queryKey: ["projects", key] });
        void queryClient.invalidateQueries({ queryKey: ["projects", key, "subprojects"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Subprojects of a project — for the sidenav tree (lighter than the full detail). */
export function useSubprojects(projectId: string | undefined) {
  return useQuery({
    queryKey: ["projects", projectId, "subprojects"],
    queryFn: () => api<ProjectDetail>(`/api/projects/projects/${projectId}`).then((r) => r.subprojects),
    enabled: !!projectId,
    staleTime: 10_000,
  });
}
