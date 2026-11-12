export type StatusCategory = "backlog" | "todo" | "in_progress" | "done" | "canceled";
export type Priority = "urgent" | "high" | "medium" | "low";
export type EpicStatus = "proposed" | "planned" | "active" | "completed" | "canceled";
export type LinkRelation = "blocks" | "relates_to" | "duplicates";
export type FieldType = "text" | "number" | "date" | "select" | "checkbox" | "url";

export interface Project {
  id: string; workspaceId: string; spaceId: string; key: string; name: string; description: string; icon: string | null;
  pointsEstimateEnabled: boolean; timeEstimateEnabled: boolean; subtasksEnabled: boolean; checklistsEnabled: boolean;
  archivedAt: string | null; createdAt: string; updatedAt: string;
  ticketCount?: number; openTicketCount?: number;
}
export interface Status { id: string; projectId: string; name: string; color: string; category: StatusCategory; position: number }
export interface TicketType { id: string; projectId: string; name: string; icon: string; color: string; position: number }
export interface LabelGroup { id: string; projectId: string; name: string; position: number }
export interface Label { id: string; projectId: string; groupId: string | null; name: string; color: string }
export interface FieldOption { id: string; fieldId: string; label: string; color: string; position: number }
export interface CustomField { id: string; projectId: string; name: string; type: FieldType; position: number; options: FieldOption[] }
export interface ProjectConfig { statuses: Status[]; ticketTypes: TicketType[]; labelGroups: LabelGroup[]; labels: Label[]; customFields: CustomField[] }

export interface Progress { total: number; done: number; canceled: number; inProgress: number; points: number; donePoints: number }
export interface Epic {
  id: string; projectId: string; title: string; description: string; status: EpicStatus; ownerUserId: string | null; priority: Priority | null;
  startDate: string | null; targetDate: string | null; position: number; progress: Progress; labelIds: string[]; createdAt: string; updatedAt: string;
}
export interface Milestone {
  id: string; projectId: string; name: string; goal: string; startDate: string; endDate: string; completedAt: string | null;
  progress: Progress; state: "upcoming" | "active" | "completed";
}
export interface Ticket {
  id: string; projectId: string; identifier: string; sequenceNumber: number; typeId: string | null; epicId: string | null; milestoneId: string | null;
  statusId: string; parentId: string | null; assigneeUserId: string | null; title: string; description: string; priority: Priority | null;
  estimatePoints: number | null; estimateMinutes: number | null; startDate: string | null; dueDate: string | null; position: number;
  archivedAt: string | null; labelIds: string[]; subtaskCount: number; subtaskDoneCount: number; createdAt: string; updatedAt: string;
}
export interface TicketRef { id: string; identifier: string; title: string; statusCategory?: StatusCategory; statusName?: string }
export interface Checklist { id: string; ticketId: string; title: string; position: number; items: { id: string; checklistId: string; text: string; done: boolean; position: number }[] }
export interface DevLink { id: string; provider: string; kind: string; url: string; title: string; state: "open" | "draft" | "merged" | "closed"; ciState: "pending" | "success" | "failure" | null }
export interface Attachment { id: string; fileName: string; contentType: string; size: number; uploadedBy: string | null; createdAt: string }
export interface Comment { id: string; userId: string | null; body: string; createdAt: string; updatedAt: string }
export interface TicketDetail extends Ticket {
  projectKey: string; parent: TicketRef | null; subtasks: Ticket[];
  links: { id: string; relation: LinkRelation; direction: "outgoing" | "incoming"; ticket: TicketRef }[];
  devLinks: DevLink[]; checklists: Checklist[]; watcherUserIds: string[]; attachments: Attachment[]; fieldValues: Record<string, unknown>; comments: Comment[];
}
export interface Activity { id: string; userId: string | null; action: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: string }
export interface Member { id: string; name: string; email: string; image: string | null; role: string }

export interface TicketFilters {
  statusId?: string; statusCategory?: string; assigneeUserId?: string; priority?: string; typeId?: string; epicId?: string; milestoneId?: string;
  labelId?: string; parentId?: string; q?: string; dueBefore?: string; dueAfter?: string; archived?: boolean;
}
export type Layout = "table" | "board" | "timeline";
export type GroupBy = "status" | "assignee" | "priority" | "epic" | "milestone" | "type";
export interface SavedView {
  id: string; projectId: string; name: string; layout: Layout; filters: TicketFilters; sortBy: string; sortDir: "asc" | "desc"; groupBy: GroupBy | null; shared: boolean; ownerUserId: string | null;
}
export interface Doc { id: string; projectId: string; kind: "doc" | "note"; parentId: string | null; title: string; content: string; createdBy: string | null; position: number; createdAt: string; updatedAt: string }
export interface Widget { id: string; type: string; title?: string; size?: "sm" | "md" | "lg" }
export interface Dashboard { id: string; projectId: string; name: string; widgets: Widget[]; position: number }
export interface TicketTemplate { id: string; projectId: string; name: string; title: string; description: string; typeId: string | null; priority: Priority | null; labelIds: string[]; checklist: { title: string; items: string[] }[] }
export interface Notification { id: string; kind: string; message: string; readAt: string | null; createdAt: string; ticketIdentifier: string | null; actorUserId: string | null }
