import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

// Wire schemas (mirror src/db/repository.ts payload types — the repo returns
// these shapes directly, same principle as twochat's manifest).

const tag = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
});

const checklistItem = z.object({
  id: z.string(),
  taskId: z.string(),
  content: z.string(),
  checked: z.boolean(),
  position: z.number(),
});

const task = z.object({
  id: z.string(),
  listId: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  descriptionHtml: z.string().nullable(),
  status: z.enum(["open", "done", "trashed"]),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  allDay: z.boolean(),
  recurrenceRule: z.string().nullable(),
  recurrenceNextAt: z.string().nullable(),
  habitId: z.string().nullable(),
  completedAt: z.string().nullable(),
  assigneeUserId: z.string().nullable(),
  position: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(tag),
  checklist: z.array(checklistItem),
  checklistTotal: z.number(),
  checklistDone: z.number(),
});

const list = z.object({
  id: z.string(),
  boardId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  position: z.number(),
  openCount: z.number(),
  dueTodayCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type BoardSchema = z.ZodObject<{
  id: z.ZodString;
  parentId: z.ZodNullable<z.ZodString>;
  name: z.ZodString;
  color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
  icon: z.ZodNullable<z.ZodOptional<z.ZodString>>;
  position: z.ZodNumber;
  collapsed: z.ZodBoolean;
  spaceId: z.ZodString;
  createdAt: z.ZodString;
  updatedAt: z.ZodString;
  lists: z.ZodArray<typeof list>;
  children: z.ZodLazy<z.ZodType<BoardSchema>>;
  openCount: z.ZodNumber;
  dueTodayCount: z.ZodNumber;
}>;

const board: BoardSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  position: z.number(),
  collapsed: z.boolean(),
  spaceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lists: z.array(list),
  children: z.array(z.lazy(() => board)),
  openCount: z.number(),
  dueTodayCount: z.number(),
}) as unknown as BoardSchema;

const habitLog = z.object({
  id: z.string(),
  habitId: z.string(),
  date: z.string(),
  count: z.number(),
  note: z.string().nullable(),
});

const habit = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  schedule: z.enum(["daily", "weekly", "interval", "monthly"]),
  intervalDays: z.number().nullable(),
  byWeekday: z.array(z.number()).nullable(),
  targetCount: z.number(),
  goalStreak: z.number().nullable(),
  direction: z.enum(["build", "quit"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  logs: z.array(habitLog),
  streak: z.number(),
  bestStreak: z.number(),
  totalCheckIns: z.number(),
});

const overview = z.object({
  boards: z.array(board),
  counts: z.object({
    today: z.number(),
    tomorrow: z.number(),
    week: z.number(),
    month: z.number(),
    all: z.number(),
    completed: z.number(),
  }),
});

// --- Endpoints -----------------------------------------------------------------

const listBoards = defineEndpoint({
  name: "listBoards",
  method: "GET",
  path: "/boards",
  auth: "session",
  description: "Full board forest for the caller's active spaces: root boards with nested children, each with lists and rollup open/due-today counts.",
  response: z.array(board),
});

const createBoard = defineEndpoint({
  name: "createBoard",
  method: "POST",
  path: "/boards",
  auth: "session",
  description: "Creates a board in a space, optionally nested under a parent board (same space).",
  request: z.object({
    spaceId: z.string(),
    parentId: z.string().nullable().optional(),
    name: z.string().min(1),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
  }),
  response: board,
});

const updateBoard = defineEndpoint({
  name: "updateBoard",
  method: "PATCH",
  path: "/boards/:id",
  auth: "session",
  description: "Rename / recolor / re-parent (cycle-guarded) / reorder / collapse a board.",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
    position: z.number().optional(),
    collapsed: z.boolean().optional(),
  }),
  response: board,
});

const deleteBoard = defineEndpoint({
  name: "deleteBoard",
  method: "DELETE",
  path: "/boards/:id",
  auth: "session",
  description: "Deletes a board with every descendant board, list, task, checklist and tag link.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const createList = defineEndpoint({
  name: "createList",
  method: "POST",
  path: "/lists",
  auth: "session",
  description: "Creates a task list inside a board.",
  request: z.object({
    boardId: z.string(),
    name: z.string().min(1),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
  }),
  response: list,
});

const updateList = defineEndpoint({
  name: "updateList",
  method: "PATCH",
  path: "/lists/:id",
  auth: "session",
  description: "Rename / recolor / move-to-board / reorder a list.",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    boardId: z.string().optional(),
    position: z.number().optional(),
  }),
  response: list,
});

const deleteList = defineEndpoint({
  name: "deleteList",
  method: "DELETE",
  path: "/lists/:id",
  auth: "session",
  description: "Deletes a list and all its tasks (hard delete).",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const listTasks = defineEndpoint({
  name: "listTasks",
  method: "GET",
  path: "/tasks",
  auth: "session",
  description:
    "Task query endpoint. One of listId / boardId / smart selects the set; filters compose. `smart` ∈ today|tomorrow|week|month|all|completed (today/week/month include overdue open tasks).",
  request: z.object({
    listId: z.string().optional(),
    boardId: z.string().optional(),
    smart: z.enum(["today", "tomorrow", "week", "month", "all", "completed"]).optional(),
    status: z.enum(["open", "done", "trashed", "any"]).optional(),
    tagId: z.string().optional(),
    q: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().optional(),
  }),
  response: z.array(task),
});

const createTask = defineEndpoint({
  name: "createTask",
  method: "POST",
  path: "/tasks",
  auth: "session",
  description:
    "Creates a task. `tagNames` auto-creates missing tags in the task's space (quick-add path); `tagIds` links existing ones. Recurring tasks compute recurrence_next_at from startAt.",
  request: z.object({
    listId: z.string(),
    parentId: z.string().nullable().optional(),
    title: z.string().min(1),
    descriptionHtml: z.string().nullable().optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    startAt: z.string().nullable().optional(),
    endAt: z.string().nullable().optional(),
    allDay: z.boolean().optional(),
    recurrenceRule: z.string().nullable().optional(),
    habitId: z.string().nullable().optional(),
    assigneeUserId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).optional(),
    tagNames: z.array(z.string()).optional(),
  }),
  response: task,
});

const getTask = defineEndpoint({
  name: "getTask",
  method: "GET",
  path: "/tasks/:id",
  auth: "session",
  description: "One task with tags + checklist.",
  request: z.object({ id: z.string() }),
  response: task,
});

const updateTask = defineEndpoint({
  name: "updateTask",
  method: "PATCH",
  path: "/tasks/:id",
  auth: "session",
  description: "Patch any task field; tagIds replaces the tag set.",
  request: z.object({
    id: z.string(),
    listId: z.string().optional(),
    parentId: z.string().nullable().optional(),
    title: z.string().optional(),
    descriptionHtml: z.string().nullable().optional(),
    status: z.enum(["open", "done", "trashed"]).optional(),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
    startAt: z.string().nullable().optional(),
    endAt: z.string().nullable().optional(),
    allDay: z.boolean().optional(),
    recurrenceRule: z.string().nullable().optional(),
    habitId: z.string().nullable().optional(),
    assigneeUserId: z.string().nullable().optional(),
    position: z.number().optional(),
    tagIds: z.array(z.string()).optional(),
  }),
  response: task,
});

const deleteTask = defineEndpoint({
  name: "deleteTask",
  method: "DELETE",
  path: "/tasks/:id",
  auth: "session",
  description: "Hard-deletes a task with subtasks, checklist items and tag links. (Soft path = PATCH status=trashed.)",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const completeTask = defineEndpoint({
  name: "completeTask",
  method: "POST",
  path: "/tasks/:id/complete",
  auth: "session",
  description:
    "Toggle completion, TickTick-style: completing a recurring task spawns the next occurrence (shifted dates, fresh unchecked checklist, copied tags) and returns it as `spawned`.",
  request: z.object({ id: z.string(), done: z.boolean() }),
  response: z.object({ task, spawned: task.nullable() }),
});

const reorderTasks = defineEndpoint({
  name: "reorderTasks",
  method: "POST",
  path: "/tasks/reorder",
  auth: "session",
  description: "Manual ordering: place a task between two neighbors (fractional position computed server-side); optionally move it to another list.",
  request: z.object({
    taskId: z.string(),
    beforeId: z.string().nullable().optional(),
    afterId: z.string().nullable().optional(),
    listId: z.string().optional(),
  }),
  response: z.object({ ok: z.boolean() }),
});

const addChecklistItem = defineEndpoint({
  name: "addChecklistItem",
  method: "POST",
  path: "/tasks/:id/checklist",
  auth: "session",
  description: "Appends a checklist (subtask) item to a task.",
  request: z.object({ id: z.string(), content: z.string().min(1) }),
  response: checklistItem,
});

const updateChecklistItem = defineEndpoint({
  name: "updateChecklistItem",
  method: "PATCH",
  path: "/checklist/:id",
  auth: "session",
  description: "Edit / toggle / reorder a checklist item.",
  request: z.object({
    id: z.string(),
    content: z.string().optional(),
    checked: z.boolean().optional(),
    position: z.number().optional(),
  }),
  response: checklistItem,
});

const deleteChecklistItem = defineEndpoint({
  name: "deleteChecklistItem",
  method: "DELETE",
  path: "/checklist/:id",
  auth: "session",
  description: "Removes a checklist item.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const listTags = defineEndpoint({
  name: "listTags",
  method: "GET",
  path: "/tags",
  auth: "session",
  description: "All tags across the caller's active spaces.",
  response: z.array(tag),
});

const createTag = defineEndpoint({
  name: "createTag",
  method: "POST",
  path: "/tags",
  auth: "session",
  description: "Creates a tag in a space (name unique per space).",
  request: z.object({ spaceId: z.string(), name: z.string().min(1), color: z.string().nullable().optional() }),
  response: tag,
});

const updateTag = defineEndpoint({
  name: "updateTag",
  method: "PATCH",
  path: "/tags/:id",
  auth: "session",
  description: "Rename / recolor a tag.",
  request: z.object({ id: z.string(), name: z.string().optional(), color: z.string().nullable().optional() }),
  response: tag,
});

const deleteTag = defineEndpoint({
  name: "deleteTag",
  method: "DELETE",
  path: "/tags/:id",
  auth: "session",
  description: "Deletes a tag and its task links.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const getOverview = defineEndpoint({
  name: "getOverview",
  method: "GET",
  path: "/overview",
  auth: "session",
  description: "Home-page bootstrap: board forest + smart-list counts in one call. Seeds a default board/list when the space is empty (first use).",
  response: overview,
});

const listHabits = defineEndpoint({
  name: "listHabits",
  method: "GET",
  path: "/habits",
  auth: "session",
  description: "Habits with logs (optionally bounded by date range) and computed streaks.",
  request: z.object({ from: z.string().optional(), to: z.string().optional() }),
  response: z.array(habit),
});

const createHabit = defineEndpoint({
  name: "createHabit",
  method: "POST",
  path: "/habits",
  auth: "session",
  description: "Creates a habit tracker.",
  request: z.object({
    spaceId: z.string(),
    name: z.string().min(1),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    schedule: z.enum(["daily", "weekly", "interval", "monthly"]).optional(),
    intervalDays: z.number().nullable().optional(),
    byWeekday: z.array(z.number()).nullable().optional(),
    targetCount: z.number().optional(),
    goalStreak: z.number().nullable().optional(),
    direction: z.enum(["build", "quit"]).optional(),
  }),
  response: habit,
});

const updateHabit = defineEndpoint({
  name: "updateHabit",
  method: "PATCH",
  path: "/habits/:id",
  auth: "session",
  description: "Edit a habit (name, schedule, goal, archive…).",
  request: z.object({
    id: z.string(),
    name: z.string().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    schedule: z.enum(["daily", "weekly", "interval", "monthly"]).optional(),
    intervalDays: z.number().nullable().optional(),
    byWeekday: z.array(z.number()).nullable().optional(),
    targetCount: z.number().optional(),
    goalStreak: z.number().nullable().optional(),
    direction: z.enum(["build", "quit"]).optional(),
    archived: z.boolean().optional(),
  }),
  response: habit,
});

const deleteHabit = defineEndpoint({
  name: "deleteHabit",
  method: "DELETE",
  path: "/habits/:id",
  auth: "session",
  description: "Deletes a habit and its logs.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.boolean() }),
});

const logHabit = defineEndpoint({
  name: "logHabit",
  method: "POST",
  path: "/habits/:id/logs",
  auth: "session",
  description: "Check in a habit for a day (delta +1/-1; the day's row is upserted, removed at zero).",
  request: z.object({ id: z.string(), date: z.string(), delta: z.number() }),
  response: habitLog.nullable(),
});

export const twodooManifest = defineAppManifest({
  name: "TwoDoo",
  slug: "twodoo",
  version: "0.1.0",
  shape: "backend+webapp",
  description: "Tasks & habits — TickTick-style boards, lists, smart lists, quick-add, recurrence, habit tracking. Implemented (v1).",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/apps/twodoo",
  endpoints: [
    listBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    createList,
    updateList,
    deleteList,
    listTasks,
    createTask,
    getTask,
    updateTask,
    deleteTask,
    completeTask,
    reorderTasks,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    listTags,
    createTag,
    updateTag,
    deleteTag,
    getOverview,
    listHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    logHabit,
  ],
});

export default twodooManifest;
