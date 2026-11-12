// Thin typed client over TwoDoo's API — always through the gateway (dev
// proxy /twodoo-api → /apps/twodoo), so identity is the shared control-plane
// session resolved by TwoDB and forwarded as x-twodb-* headers.

export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "done" | "trashed";
export type SmartListKey = "today" | "tomorrow" | "week" | "month" | "all" | "completed";
export type HabitSchedule = "daily" | "weekly" | "interval" | "monthly";

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  content: string;
  checked: boolean;
  position: number;
}

export interface Task {
  id: string;
  listId: string;
  parentId: string | null;
  title: string;
  descriptionHtml: string | null;
  status: TaskStatus;
  priority: Priority;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  recurrenceRule: string | null;
  recurrenceNextAt: string | null;
  habitId: string | null;
  completedAt: string | null;
  assigneeUserId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  checklist: ChecklistItem[];
  checklistTotal: number;
  checklistDone: number;
}

export interface TaskList {
  id: string;
  boardId: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  openCount: number;
  dueTodayCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  parentId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  collapsed: boolean;
  spaceId: string;
  createdAt: string;
  updatedAt: string;
  lists: TaskList[];
  children: Board[];
  openCount: number;
  dueTodayCount: number;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  count: number;
  note: string | null;
}

export interface Habit {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  schedule: HabitSchedule;
  intervalDays: number | null;
  byWeekday: number[] | null;
  targetCount: number;
  goalStreak: number | null;
  direction: "build" | "quit";
  createdAt: string;
  updatedAt: string;
  logs: HabitLog[];
  streak: number;
  bestStreak: number;
  totalCheckIns: number;
}

export interface Overview {
  boards: Board[];
  counts: { today: number; tomorrow: number; week: number; month: number; all: number; completed: number };
}

export interface TaskQuery {
  listId?: string;
  boardId?: string;
  smart?: SmartListKey;
  status?: TaskStatus | "any";
  tagId?: string;
  q?: string;
  from?: string;
  to?: string;
}

const BASE = "/twodoo-api";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const qs = (q: TaskQuery): string => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
};

export const twodooApi = {
  // boards / lists
  listBoards: () => call<Board[]>("/boards"),
  createBoard: (input: { spaceId: string; parentId?: string | null; name: string; color?: string | null }) =>
    call<Board>("/boards", { method: "POST", body: JSON.stringify(input) }),
  updateBoard: (id: string, patch: { name?: string; color?: string | null; parentId?: string | null; collapsed?: boolean }) =>
    call<Board>(`/boards/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteBoard: (id: string) => call<{ ok: boolean }>(`/boards/${id}`, { method: "DELETE" }),
  createList: (input: { boardId: string; name: string; color?: string | null }) =>
    call<TaskList>("/lists", { method: "POST", body: JSON.stringify(input) }),
  updateList: (id: string, patch: { name?: string; color?: string | null; boardId?: string }) =>
    call<TaskList>(`/lists/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteList: (id: string) => call<{ ok: boolean }>(`/lists/${id}`, { method: "DELETE" }),

  // tasks
  listTasks: (q: TaskQuery = {}) => call<Task[]>(`/tasks${qs(q)}`),
  createTask: (input: {
    listId: string;
    title: string;
    priority?: Priority;
    startAt?: string | null;
    endAt?: string | null;
    allDay?: boolean;
    recurrenceRule?: string | null;
    tagIds?: string[];
    tagNames?: string[];
    parentId?: string | null;
  }) => call<Task>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  getTask: (id: string) => call<Task>(`/tasks/${id}`),
  updateTask: (id: string, patch: Record<string, unknown>) => call<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTask: (id: string) => call<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" }),
  completeTask: (id: string, done: boolean) =>
    call<{ task: Task; spawned: Task | null }>(`/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ done }) }),
  reorderTask: (input: { taskId: string; beforeId?: string | null; afterId?: string | null; listId?: string }) =>
    call<{ ok: boolean }>("/tasks/reorder", { method: "POST", body: JSON.stringify(input) }),

  // checklist
  addChecklistItem: (taskId: string, content: string) =>
    call<ChecklistItem>(`/tasks/${taskId}/checklist`, { method: "POST", body: JSON.stringify({ content }) }),
  updateChecklistItem: (id: string, patch: { content?: string; checked?: boolean }) =>
    call<ChecklistItem>(`/checklist/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteChecklistItem: (id: string) => call<{ ok: boolean }>(`/checklist/${id}`, { method: "DELETE" }),

  // tags
  listTags: () => call<Tag[]>("/tags"),
  updateTag: (id: string, patch: { name?: string; color?: string | null }) =>
    call<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  // overview + habits
  getOverview: () => call<Overview>("/overview"),
  listHabits: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return call<Habit[]>(`/habits${qs ? `?${qs}` : ""}`);
  },
  createHabit: (input: { spaceId: string; name: string; schedule?: HabitSchedule; byWeekday?: number[] | null; targetCount?: number; goalStreak?: number | null; color?: string | null }) =>
    call<Habit>("/habits", { method: "POST", body: JSON.stringify(input) }),
  updateHabit: (id: string, patch: Record<string, unknown>) => call<Habit>(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteHabit: (id: string) => call<{ ok: boolean }>(`/habits/${id}`, { method: "DELETE" }),
  logHabit: (id: string, date: string, delta: number) =>
    call<HabitLog | null>(`/habits/${id}/logs`, { method: "POST", body: JSON.stringify({ date, delta }) }),
};
