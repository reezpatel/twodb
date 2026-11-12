import type { Priority, StatusCategory, EpicStatus } from "./types";

export const PRIORITIES: { id: Priority; label: string; color: string; rank: number }[] = [
  { id: "urgent", label: "Urgent", color: "#ef4444", rank: 0 },
  { id: "high", label: "High", color: "#f97316", rank: 1 },
  { id: "medium", label: "Medium", color: "#eab308", rank: 2 },
  { id: "low", label: "Low", color: "#60a5fa", rank: 3 },
];
export const priorityMeta = (p: Priority | null) => PRIORITIES.find((x) => x.id === p) ?? null;

export const CATEGORIES: { id: StatusCategory; label: string }[] = [
  { id: "backlog", label: "Backlog" }, { id: "todo", label: "Todo" }, { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" }, { id: "canceled", label: "Canceled" },
];
export const isOpen = (c: StatusCategory | undefined) => c === "backlog" || c === "todo" || c === "in_progress";

export const EPIC_STATUSES: { id: EpicStatus; label: string; color: string }[] = [
  { id: "proposed", label: "Proposed", color: "#9ca3af" }, { id: "planned", label: "Planned", color: "#60a5fa" },
  { id: "active", label: "Active", color: "#f59e0b" }, { id: "completed", label: "Completed", color: "#22c55e" }, { id: "canceled", label: "Canceled", color: "#ef4444" },
];
export const epicStatusMeta = (s: EpicStatus) => EPIC_STATUSES.find((x) => x.id === s)!;

export const RELATIONS = [
  { id: "blocks", label: "Blocks", inverse: "Blocked by" }, { id: "relates_to", label: "Relates to", inverse: "Relates to" }, { id: "duplicates", label: "Duplicates", inverse: "Duplicated by" },
] as const;

export const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#9ca3af"];
