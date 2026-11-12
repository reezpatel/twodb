import { ulid } from "ulid";
import type { Kysely } from "@twodb/core-data/db";
import type { TwoDooDb, Priority, TaskStatus, HabitSchedule, HabitDirection } from "./schema.js";
import { nextOccurrence, canRecur, parseRule } from "../recurrence.js";

/**
 * Data access for TwoDoo. All reads/writes go through here; route handlers
 * stay thin. Payload shapes mirror the manifest's Zod wire schemas (one wire
 * shape everywhere — same principle as twochat's repo).
 *
 * Space scoping: every call takes a SpaceScope { workspaceId, spaceIds } —
 * spaceIds empty = every space in the workspace (gateway sends the user's
 * active spaces; empty header means "all").
 */

export interface SpaceScope {
  workspaceId: string;
  spaceIds: string[];
}

export type SmartList = "today" | "tomorrow" | "week" | "month" | "all" | "completed";

// --- wire payloads ------------------------------------------------------------

export interface TagPayload {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface ChecklistItemPayload {
  id: string;
  taskId: string;
  content: string;
  checked: boolean;
  position: number;
}

export interface TaskPayload {
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
  tags: TagPayload[];
  checklist: ChecklistItemPayload[];
  checklistTotal: number;
  checklistDone: number;
}

export interface ListPayload {
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

export interface BoardPayload {
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
  lists: ListPayload[];
  children: BoardPayload[];
  openCount: number;
  dueTodayCount: number;
}

export interface HabitLogPayload {
  id: string;
  habitId: string;
  date: string;
  count: number;
  note: string | null;
}

export interface HabitPayload {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  schedule: HabitSchedule;
  intervalDays: number | null;
  byWeekday: number[] | null;
  targetCount: number;
  goalStreak: number | null;
  direction: HabitDirection;
  createdAt: string;
  updatedAt: string;
  logs: HabitLogPayload[];
  streak: number;
  bestStreak: number;
  totalCheckIns: number;
}

export interface OverviewPayload {
  boards: BoardPayload[];
  counts: { today: number; tomorrow: number; week: number; month: number; all: number; completed: number };
}

// --- helpers -------------------------------------------------------------------

const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : d);

type Db = Kysely<TwoDooDb>;

export function createTwoDooRepo(db: Db) {
  const nextPosition = async (opts: { space_id?: string; board_id?: string; task_id?: string }) => {
    if (opts.task_id) {
      const row = await db.selectFrom("checklist_item").select((eb) => eb.fn.max<number | null>("position").as("max")).where("task_id", "=", opts.task_id).executeTakeFirst();
      return (row?.max ?? -1024) + 1024;
    }
    if (opts.board_id) {
      const row = await db.selectFrom("list").select((eb) => eb.fn.max<number | null>("position").as("max")).where("board_id", "=", opts.board_id).executeTakeFirst();
      return (row?.max ?? -1024) + 1024;
    }
    if (opts.space_id) {
      const row = await db.selectFrom("board").select((eb) => eb.fn.max<number | null>("position").as("max")).where("space_id", "=", opts.space_id).where("parent_board_id", "is", null).executeTakeFirst();
      return (row?.max ?? -1024) + 1024;
    }
    return 0;
  };

  // --- tags ----------------------------------------------------------------

  async function listTags(scope: SpaceScope): Promise<TagPayload[]> {
    const rows = await db.selectFrom("tag").selectAll().where("workspace_id", "=", scope.workspaceId).orderBy("name").execute();
    return rows.map(rowToTag);
  }

  async function ensureTag(scope: SpaceScope, spaceId: string, name: string): Promise<TagPayload> {
    const existing = await db
      .selectFrom("tag")
      .selectAll()
      .where("workspace_id", "=", scope.workspaceId)
      .where("space_id", "=", spaceId)
      .where("name", "=", name)
      .executeTakeFirst();
    if (existing) return rowToTag(existing);
    const id = `tag_${ulid()}`;
    const row = { id, workspace_id: scope.workspaceId, space_id: spaceId, name, color: null, created_at: new Date().toISOString() };
    await db.insertInto("tag").values(row).execute();
    return rowToTag(row);
  }

  async function updateTag(scope: SpaceScope, id: string, patch: { name?: string; color?: string | null }): Promise<TagPayload | null> {
    const values: Record<string, unknown> = {};
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.color !== undefined) values.color = patch.color;
    if (!Object.keys(values).length) {
      const row = await db.selectFrom("tag").selectAll().where("id", "=", id).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
      return row ? rowToTag(row) : null;
    }
    const row = await db.updateTable("tag").set(values).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).returningAll().executeTakeFirst();
    return row ? rowToTag(row) : null;
  }

  async function deleteTag(scope: SpaceScope, id: string): Promise<boolean> {
    const rows = await db.deleteFrom("tag").where("id", "=", id).where("workspace_id", "=", scope.workspaceId).returning("id").execute();
    if (rows.length) await db.deleteFrom("task_tag").where("tag_id", "=", id).execute();
    return rows.length > 0;
  }

  // --- tasks ----------------------------------------------------------------

  async function hydrateTasks(scope: SpaceScope, rows: TwoDooDb["task"][]): Promise<TaskPayload[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const tagRows = await db
      .selectFrom("task_tag")
      .innerJoin("tag", "tag.id", "task_tag.tag_id")
      .select(["task_tag.task_id", "tag.id as tag_id", "tag.name", "tag.color", "tag.created_at"])
      .where("task_tag.task_id", "in", ids)
      .execute();
    const checklistRows = await db
      .selectFrom("checklist_item")
      .selectAll()
      .where("task_id", "in", ids)
      .orderBy("position")
      .execute();
    const tagsByTask = new Map<string, TagPayload[]>();
    for (const t of tagRows) {
      const list = tagsByTask.get(t.task_id) ?? [];
      list.push({ id: t.tag_id, name: t.name, color: t.color, createdAt: iso(t.created_at)! });
      tagsByTask.set(t.task_id, list);
    }
    const clByTask = new Map<string, TwoDooDb["checklist_item"][]>();
    for (const c of checklistRows) {
      const list = clByTask.get(c.task_id) ?? [];
      list.push(c);
      clByTask.set(c.task_id, list);
    }
    return rows.map((r) => {
      const cl = clByTask.get(r.id) ?? [];
      return {
        id: r.id,
        listId: r.list_id,
        parentId: r.parent_task_id,
        title: r.title,
        descriptionHtml: r.description_html,
        status: r.status,
        priority: r.priority,
        startAt: iso(r.start_at),
        endAt: iso(r.end_at),
        allDay: r.all_day,
        recurrenceRule: r.recurrence_rule,
        recurrenceNextAt: iso(r.recurrence_next_at),
        habitId: r.habit_id,
        completedAt: iso(r.completed_at),
        assigneeUserId: r.assignee_user_id,
        position: r.position,
        createdAt: iso(r.created_at)!,
        updatedAt: iso(r.updated_at)!,
        tags: tagsByTask.get(r.id) ?? [],
        checklist: cl.map(rowToChecklist),
        checklistTotal: cl.length,
        checklistDone: cl.filter((c) => c.checked).length,
      };
    });
  }

  function baseTaskQuery(scope: SpaceScope) {
    let qb = db.selectFrom("task").selectAll().where("workspace_id", "=", scope.workspaceId);
    if (scope.spaceIds.length) qb = qb.where("space_id", "in", scope.spaceIds);
    return qb;
  }

  async function listTasks(
    scope: SpaceScope,
    filters: {
      listId?: string;
      boardId?: string;
      smart?: SmartList;
      status?: TaskStatus | "any";
      tagId?: string;
      q?: string;
      from?: string; // ISO
      to?: string; // ISO
      limit?: number;
    },
  ): Promise<TaskPayload[]> {
    let qb = baseTaskQuery(scope);

    if (filters.listId) qb = qb.where("list_id", "=", filters.listId);

    if (filters.boardId) {
      // all descendant lists of the board (boards nest)
      const listIds = await descendantListIds(scope, filters.boardId);
      if (!listIds.length) return [];
      qb = qb.where("list_id", "in", listIds);
    }

    const status = filters.status ?? (filters.smart === "completed" ? "done" : "open");
    if (status !== "any") qb = qb.where("status", "=", status);

    if (filters.tagId) {
      const taskIds = await db.selectFrom("task_tag").select("task_id").where("tag_id", "=", filters.tagId).execute();
      const ids = taskIds.map((t) => t.task_id);
      if (!ids.length) return [];
      qb = qb.where("id", "in", ids);
    }

    if (filters.q) {
      qb = qb.where((eb) => eb.or([eb("title", "ilike", `%${filters.q}%`), eb("description_html", "ilike", `%${filters.q}%`)]));
    }

    if (filters.from || filters.to) {
      if (filters.from) qb = qb.where("end_at", ">=", filters.from);
      if (filters.to) qb = qb.where("start_at", "<=", filters.to);
    }

    const smart = filters.smart;
    if (smart === "today" || smart === "tomorrow" || smart === "week" || smart === "month") {
      const ranges = smartRanges(new Date(), smart);
      if (ranges) {
        const { start, end, includeOverdue } = ranges;
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        qb = qb.where((eb) => {
          const inRange = eb.and([eb("start_at", ">=", startIso), eb("start_at", "<=", endIso)]);
          if (includeOverdue) {
            return eb.or([inRange, eb.and([eb("start_at", "<", startIso), eb("completed_at", "is", null)])]);
          }
          return inRange;
        });
      }
    }

    const rows = await qb.orderBy("position").orderBy("created_at").limit(filters.limit ?? 1000).execute();
    return hydrateTasks(scope, rows);
  }

  async function getTask(scope: SpaceScope, id: string): Promise<TaskPayload | null> {
    const rows = await db.selectFrom("task").selectAll().where("id", "=", id).where("workspace_id", "=", scope.workspaceId).execute();
    const hydrated = await hydrateTasks(scope, rows);
    return hydrated[0] ?? null;
  }

  interface CreateTaskInput {
    listId: string;
    parentId?: string | null;
    title: string;
    descriptionHtml?: string | null;
    priority?: Priority;
    startAt?: string | null;
    endAt?: string | null;
    allDay?: boolean;
    recurrenceRule?: string | null;
    habitId?: string | null;
    assigneeUserId?: string | null;
    tagIds?: string[];
    tagNames?: string[];
  }

  async function createTask(scope: SpaceScope, input: CreateTaskInput): Promise<TaskPayload | null> {
    const listRow = await db
      .selectFrom("list")
      .selectAll()
      .where("id", "=", input.listId)
      .where("workspace_id", "=", scope.workspaceId)
      .executeTakeFirst();
    if (!listRow) return null;

    const parentPosition = await db
      .selectFrom("task")
      .select((eb) => eb.fn.max<number | null>("position").as("max"))
      .where("list_id", "=", input.listId)
      .where("parent_task_id", "is", null)
      .executeTakeFirst();
    const position = (parentPosition?.max ?? -1024) + 1024;

    const id = `tsk_${ulid()}`;
    const startAt = input.startAt ?? null;
    await db.insertInto("task").values({
      id,
      workspace_id: scope.workspaceId,
      space_id: listRow.space_id,
      list_id: input.listId,
      parent_task_id: input.parentId ?? null,
      title: input.title,
      description_html: input.descriptionHtml ?? null,
      status: "open",
      priority: input.priority ?? "none",
      start_at: startAt,
      end_at: input.endAt ?? startAt,
      all_day: input.allDay ?? false,
      recurrence_rule: input.recurrenceRule ?? null,
      recurrence_next_at: startAt,
      habit_id: input.habitId ?? null,
      completed_at: null,
      assignee_user_id: input.assigneeUserId ?? null,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    // tags: ids + auto-create names
    const tagIds = new Set(input.tagIds ?? []);
    if (input.tagNames?.length) {
      for (const name of input.tagNames) {
        const tag = await ensureTag(scope, listRow.space_id, name);
        tagIds.add(tag.id);
      }
    }
    for (const tagId of tagIds) {
      await db.insertInto("task_tag").values({ task_id: id, tag_id: tagId }).execute();
    }
    return getTask(scope, id);
  }

  interface UpdateTaskInput {
    title?: string;
    descriptionHtml?: string | null;
    status?: TaskStatus;
    priority?: Priority;
    startAt?: string | null;
    endAt?: string | null;
    allDay?: boolean;
    recurrenceRule?: string | null;
    habitId?: string | null;
    assigneeUserId?: string | null;
    listId?: string;
    parentId?: string | null;
    position?: number;
    tagIds?: string[];
  }

  async function updateTask(scope: SpaceScope, id: string, patch: UpdateTaskInput): Promise<TaskPayload | null> {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) values.title = patch.title;
    if (patch.descriptionHtml !== undefined) values.description_html = patch.descriptionHtml;
    if (patch.priority !== undefined) values.priority = patch.priority;
    if (patch.listId !== undefined) values.list_id = patch.listId;
    if (patch.parentId !== undefined) values.parent_task_id = patch.parentId;
    if (patch.position !== undefined) values.position = patch.position;
    if (patch.habitId !== undefined) values.habit_id = patch.habitId;
    if (patch.assigneeUserId !== undefined) values.assignee_user_id = patch.assigneeUserId;
    if (patch.startAt !== undefined) values.start_at = patch.startAt;
    if (patch.endAt !== undefined) values.end_at = patch.endAt;
    if (patch.allDay !== undefined) values.all_day = patch.allDay;
    if (patch.recurrenceRule !== undefined) {
      values.recurrence_rule = patch.recurrenceRule;
      const current = await db.selectFrom("task").select(["start_at"]).where("id", "=", id).executeTakeFirst();
      values.recurrence_next_at = patch.recurrenceRule && current?.start_at ? current.start_at : null;
    }
    if (patch.status !== undefined) {
      values.status = patch.status;
      values.completed_at = patch.status === "done" ? new Date().toISOString() : null;
    }

    await db.updateTable("task").set(values).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).execute();

    if (patch.tagIds !== undefined) {
      await db.deleteFrom("task_tag").where("task_id", "=", id).execute();
      for (const tagId of patch.tagIds) {
        await db.insertInto("task_tag").values({ task_id: id, tag_id: tagId }).execute();
      }
    }
    return getTask(scope, id);
  }

  async function deleteTask(scope: SpaceScope, id: string): Promise<void> {
    const ids = [...(await collectDescendantTaskIds(id)), id];
    await db.deleteFrom("checklist_item").where("task_id", "in", ids).execute();
    await db.deleteFrom("task_tag").where("task_id", "in", ids).execute();
    await db.deleteFrom("task").where("id", "in", ids).where("workspace_id", "=", scope.workspaceId).execute();
  }

  async function collectDescendantTaskIds(id: string, acc: string[] = []): Promise<string[]> {
    const children = await db.selectFrom("task").select("id").where("parent_task_id", "=", id).execute();
    for (const child of children) {
      acc.push(child.id);
      await collectDescendantTaskIds(child.id, acc);
    }
    return acc;
  }

  /**
   * TickTick-style completion: recurring tasks spawn the next occurrence
   * (shifted start/end, fresh checklist copies) and the completed instance
   * stays as history. Non-recurring just flips status.
   */
  async function completeTask(scope: SpaceScope, id: string, done: boolean): Promise<{ task: TaskPayload; spawned: TaskPayload | null }> {
    const row = await db.selectFrom("task").selectAll().where("id", "=", id).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
    if (!row) throw new Error("not_found");

    if (!done) {
      const updated = await updateTask(scope, id, { status: "open" });
      return { task: updated!, spawned: null };
    }

    const rule = parseRule(row.recurrence_rule);
    const completedCount = await db
      .selectFrom("task")
      .select((eb) => eb.fn.count<number>("id").as("n"))
      .where("list_id", "=", row.list_id)
      .where("title", "=", row.title)
      .where("status", "=", "done")
      .executeTakeFirst();
    const alreadyDone = Number(completedCount?.n ?? 0);

    let spawned: TaskPayload | null = null;
    if (rule && canRecur(row.recurrence_rule, alreadyDone + 1)) {
      const anchor = row.recurrence_next_at ? new Date(row.recurrence_next_at) : row.start_at ? new Date(row.start_at) : new Date();
      const nextStart = nextOccurrence(row.recurrence_rule, anchor);
      if (nextStart) {
        const duration = row.start_at && row.end_at ? new Date(row.end_at).getTime() - new Date(row.start_at).getTime() : 0;
        const nextId = `tsk_${ulid()}`;
        await db.insertInto("task").values({
          id: nextId,
          workspace_id: row.workspace_id,
          space_id: row.space_id,
          list_id: row.list_id,
          parent_task_id: null,
          title: row.title,
          description_html: row.description_html,
          status: "open",
          priority: row.priority,
          start_at: nextStart.toISOString(),
          end_at: new Date(nextStart.getTime() + duration).toISOString(),
          all_day: row.all_day,
          recurrence_rule: row.recurrence_rule,
          recurrence_next_at: nextStart.toISOString(),
          habit_id: row.habit_id,
          completed_at: null,
          assignee_user_id: row.assignee_user_id,
          position: row.position,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).execute();
        // copy checklist (unchecked)
        const cl = await db.selectFrom("checklist_item").selectAll().where("task_id", "=", id).orderBy("position").execute();
        for (const item of cl) {
          await db.insertInto("checklist_item").values({
            id: `chk_${ulid()}`,
            workspace_id: row.workspace_id,
            task_id: nextId,
            content: item.content,
            checked: false,
            position: item.position,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).execute();
        }
        // copy tags
        const tagLinks = await db.selectFrom("task_tag").select(["task_id", "tag_id"]).where("task_id", "=", id).execute();
        for (const t of tagLinks) {
          await db.insertInto("task_tag").values({ task_id: nextId, tag_id: t.tag_id }).execute();
        }
        spawned = await getTask(scope, nextId);
      }
    }

    const task = await updateTask(scope, id, { status: "done" });
    return { task: task!, spawned };
  }

  async function reorderTasks(scope: SpaceScope, taskId: string, beforeId: string | null, afterId: string | null, listId?: string): Promise<void> {
    // Compute target position between neighbors (or move to list end).
    const targetList = listId ?? (await db.selectFrom("task").select("list_id").where("id", "=", taskId).executeTakeFirst())?.list_id;
    if (!targetList) return;
    let pos: number;
    if (beforeId && afterId) {
      const [before, after] = await Promise.all([
        db.selectFrom("task").select("position").where("id", "=", beforeId).executeTakeFirst(),
        db.selectFrom("task").select("position").where("id", "=", afterId).executeTakeFirst(),
      ]);
      pos = Math.round(((before?.position ?? 0) + (after?.position ?? 0)) / 2);
    } else if (beforeId) {
      const before = await db.selectFrom("task").select("position").where("id", "=", beforeId).executeTakeFirst();
      pos = (before?.position ?? 0) + 1024;
    } else {
      const max = await db.selectFrom("task").select((eb) => eb.fn.max<number | null>("position").as("max")).where("list_id", "=", targetList).executeTakeFirst();
      pos = (max?.max ?? -1024) + 1024;
    }
    const values: Record<string, unknown> = { position: pos, updated_at: new Date().toISOString() };
    if (listId) values.list_id = listId;
    await db.updateTable("task").set(values).where("id", "=", taskId).where("workspace_id", "=", scope.workspaceId).execute();
  }

  // --- checklist --------------------------------------------------------------

  async function addChecklistItem(scope: SpaceScope, taskId: string, content: string): Promise<ChecklistItemPayload | null> {
    const task = await db.selectFrom("task").selectAll().where("id", "=", taskId).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
    if (!task) return null;
    const max = await db.selectFrom("checklist_item").select((eb) => eb.fn.max<number | null>("position").as("max")).where("task_id", "=", taskId).executeTakeFirst();
    const id = `chk_${ulid()}`;
    const row = {
      id,
      workspace_id: scope.workspaceId,
      task_id: taskId,
      content,
      checked: false,
      position: (max?.max ?? -1024) + 1024,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.insertInto("checklist_item").values(row).execute();
    return rowToChecklist(row);
  }

  async function updateChecklistItem(scope: SpaceScope, id: string, patch: { content?: string; checked?: boolean; position?: number }): Promise<ChecklistItemPayload | null> {
    const values: Record<string, unknown> = {};
    if (patch.content !== undefined) values.content = patch.content;
    if (patch.checked !== undefined) values.checked = patch.checked;
    if (patch.position !== undefined) values.position = patch.position;
    values.updated_at = new Date().toISOString();
    const row = await db.updateTable("checklist_item").set(values).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).returningAll().executeTakeFirst();
    return row ? rowToChecklist(row) : null;
  }

  async function deleteChecklistItem(scope: SpaceScope, id: string): Promise<boolean> {
    const rows = await db.deleteFrom("checklist_item").where("id", "=", id).where("workspace_id", "=", scope.workspaceId).returning("id").execute();
    return rows.length > 0;
  }

  // --- boards / lists ----------------------------------------------------------

  async function descendantListIds(scope: SpaceScope, boardId: string): Promise<string[]> {
    const queue = [boardId];
    const seen = new Set<string>([boardId]);
    const out: string[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      const lists = await db.selectFrom("list").select("id").where("board_id", "=", current).execute();
      out.push(...lists.map((l) => l.id));
      const childBoards = await db.selectFrom("board").select("id").where("parent_board_id", "=", current).execute();
      for (const cb of childBoards) {
        if (!seen.has(cb.id)) {
          seen.add(cb.id);
          queue.push(cb.id);
        }
      }
    }
    return out;
  }

  async function listBoards(scope: SpaceScope): Promise<BoardPayload[]> {
    const boardRows = await db
      .selectFrom("board")
      .selectAll()
      .where("workspace_id", "=", scope.workspaceId)
      .orderBy("position")
      .execute();
    const scoped = scope.spaceIds.length ? boardRows.filter((b) => scope.spaceIds.includes(b.space_id)) : boardRows;
    const listRows = await db
      .selectFrom("list")
      .selectAll()
      .where("workspace_id", "=", scope.workspaceId)
      .orderBy("position")
      .execute();
    const listIds = new Set(listRows.map((l) => l.id));
    const counts = await countByList(scope, listRows.map((l) => l.id));

    const boardPayloads = new Map<string, BoardPayload>();
    for (const b of scoped) {
      boardPayloads.set(b.id, {
        id: b.id,
        parentId: b.parent_board_id,
        name: b.name,
        color: b.color,
        icon: b.icon,
        position: b.position,
        collapsed: b.collapsed,
        spaceId: b.space_id,
        createdAt: iso(b.created_at)!,
        updatedAt: iso(b.updated_at)!,
        lists: [],
        children: [],
        openCount: 0,
        dueTodayCount: 0,
      });
    }
    for (const l of listRows) {
      const parent = boardPayloads.get(l.board_id);
      if (!parent || parent.spaceId !== l.space_id) continue;
      parent.lists.push({
        id: l.id,
        boardId: l.board_id,
        name: l.name,
        color: l.color,
        icon: l.icon,
        position: l.position,
        openCount: counts.get(l.id)?.open ?? 0,
        dueTodayCount: counts.get(l.id)?.dueToday ?? 0,
        createdAt: iso(l.created_at)!,
        updatedAt: iso(l.updated_at)!,
      });
    }
    const roots: BoardPayload[] = [];
    for (const board of boardPayloads.values()) {
      const parent = board.parentId ? boardPayloads.get(board.parentId) : undefined;
      if (parent && parent.spaceId === board.spaceId) parent.children.push(board);
      else roots.push(board);
    }
    // rollup counts bottom-up
    const rollup = (b: BoardPayload): { open: number; dueToday: number } => {
      let open = 0;
      let dueToday = 0;
      for (const l of b.lists) {
        open += l.openCount;
        dueToday += l.dueTodayCount;
      }
      for (const c of b.children) {
        const sub = rollup(c);
        open += sub.open;
        dueToday += sub.dueToday;
      }
      b.openCount = open;
      b.dueTodayCount = dueToday;
      return { open, dueToday };
    };
    roots.forEach(rollup);
    return roots;
  }

  async function countByList(scope: SpaceScope, listIds: string[]): Promise<Map<string, { open: number; dueToday: number }>> {
    const out = new Map<string, { open: number; dueToday: number }>();
    if (!listIds.length) return out;
    const { start, end } = smartRanges(new Date(), "today")!;
    const rows = await db
      .selectFrom("task")
      .select(["list_id", "status", "start_at"])
      .where("workspace_id", "=", scope.workspaceId)
      .where("list_id", "in", listIds)
      .where("parent_task_id", "is", null)
      .execute();
    for (const r of rows) {
      const entry = out.get(r.list_id) ?? { open: 0, dueToday: 0 };
      if (r.status === "open") {
        entry.open += 1;
        const s = r.start_at ? new Date(r.start_at) : null;
        if (s && s.getTime() <= end.getTime() && s.getTime() >= start.getTime() - 1000 * 60 * 60 * 24 * 365) {
          entry.dueToday += 1;
        }
      }
      out.set(r.list_id, entry);
    }
    return out;
  }

  async function createBoard(scope: SpaceScope, input: { spaceId: string; parentId?: string | null; name: string; color?: string | null; icon?: string | null }): Promise<BoardPayload | null> {
    const id = `brd_${ulid()}`;
    const position = await db
      .selectFrom("board")
      .select((eb) => eb.fn.max<number | null>("position").as("max"))
      .where("space_id", "=", input.spaceId)
      .where("parent_board_id", "=", input.parentId ?? null)
      .executeTakeFirst();
    await db.insertInto("board").values({
      id,
      workspace_id: scope.workspaceId,
      space_id: input.spaceId,
      parent_board_id: input.parentId ?? null,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      position: (position?.max ?? -1024) + 1024,
      collapsed: false,
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();
    const boards = await listBoards(scope);
    return findBoard(boards, id);
  }

  async function updateBoard(scope: SpaceScope, id: string, patch: { name?: string; color?: string | null; icon?: string | null; parentId?: string | null; position?: number; collapsed?: boolean }): Promise<BoardPayload | null> {
    // prevent cycles when re-parenting
    if (patch.parentId !== undefined && patch.parentId !== null) {
      const ids = await descendantBoardIds(scope, id);
      if (ids.has(patch.parentId)) throw new Error("cycle");
    }
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.color !== undefined) values.color = patch.color;
    if (patch.icon !== undefined) values.icon = patch.icon;
    if (patch.parentId !== undefined) values.parent_board_id = patch.parentId;
    if (patch.position !== undefined) values.position = patch.position;
    if (patch.collapsed !== undefined) values.collapsed = patch.collapsed;
    await db.updateTable("board").set(values).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).execute();
    const boards = await listBoards(scope);
    return findBoard(boards, id);
  }

  async function deleteBoard(scope: SpaceScope, id: string): Promise<void> {
    const boardIds = [...(await descendantBoardIds(scope, id))];
    const listIds = await descendantListIds(scope, id);
    for (const listId of listIds) {
      const tasks = await db.selectFrom("task").select("id").where("list_id", "=", listId).execute();
      for (const t of tasks) await deleteTask(scope, t.id);
      await db.deleteFrom("list").where("id", "=", listId).execute();
    }
    await db.deleteFrom("board").where("id", "in", boardIds).where("workspace_id", "=", scope.workspaceId).execute();
  }

  async function descendantBoardIds(scope: SpaceScope, boardId: string): Promise<Set<string>> {
    const all = await db.selectFrom("board").select(["id", "parent_board_id"]).where("workspace_id", "=", scope.workspaceId).execute();
    const childrenOf = new Map<string, string[]>();
    for (const b of all) {
      if (b.parent_board_id) {
        const list = childrenOf.get(b.parent_board_id) ?? [];
        list.push(b.id);
        childrenOf.set(b.parent_board_id, list);
      }
    }
    const out = new Set<string>([boardId]);
    const queue = [boardId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const child of childrenOf.get(current) ?? []) {
        if (!out.has(child)) {
          out.add(child);
          queue.push(child);
        }
      }
    }
    return out;
  }

  async function createList(scope: SpaceScope, input: { boardId: string; name: string; color?: string | null; icon?: string | null }): Promise<ListPayload | null> {
    const board = await db.selectFrom("board").selectAll().where("id", "=", input.boardId).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
    if (!board) return null;
    const max = await db.selectFrom("list").select((eb) => eb.fn.max<number | null>("position").as("max")).where("board_id", "=", input.boardId).executeTakeFirst();
    const id = `lst_${ulid()}`;
    await db.insertInto("list").values({
      id,
      workspace_id: scope.workspaceId,
      space_id: board.space_id,
      board_id: input.boardId,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      position: (max?.max ?? -1024) + 1024,
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();
    return { id, boardId: input.boardId, name: input.name, color: input.color ?? null, icon: input.icon ?? null, position: (max?.max ?? -1024) + 1024, openCount: 0, dueTodayCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  async function updateList(scope: SpaceScope, id: string, patch: { name?: string; color?: string | null; icon?: string | null; boardId?: string; position?: number }): Promise<ListPayload | null> {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.color !== undefined) values.color = patch.color;
    if (patch.icon !== undefined) values.icon = patch.icon;
    if (patch.boardId !== undefined) values.board_id = patch.boardId;
    if (patch.position !== undefined) values.position = patch.position;
    await db.updateTable("list").set(values).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).execute();
    const row = await db.selectFrom("list").selectAll().where("id", "=", id).executeTakeFirst();
    if (!row) return null;
    return { id: row.id, boardId: row.board_id, name: row.name, color: row.color, icon: row.icon, position: row.position, openCount: 0, dueTodayCount: 0, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
  }

  async function deleteList(scope: SpaceScope, id: string): Promise<void> {
    const tasks = await db.selectFrom("task").select("id").where("list_id", "=", id).execute();
    for (const t of tasks) await deleteTask(scope, t.id);
    await db.deleteFrom("list").where("id", "=", id).where("workspace_id", "=", scope.workspaceId).execute();
  }

  // --- overview ----------------------------------------------------------------

  async function overview(scope: SpaceScope): Promise<OverviewPayload> {
    const boards = await listBoards(scope);
    const counts = { today: 0, tomorrow: 0, week: 0, month: 0, all: 0, completed: 0 };
    const withSpace = await db
      .selectFrom("task")
      .select(["status", "start_at", "space_id", "completed_at"])
      .where("workspace_id", "=", scope.workspaceId)
      .where("parent_task_id", "is", null)
      .execute();
    const filtered = scope.spaceIds.length ? withSpace.filter((r) => scope.spaceIds.includes(r.space_id)) : withSpace;
    const now = new Date();
    for (const r of filtered) {
      if (r.status === "open") counts.all += 1;
      if (r.status === "done") {
        counts.completed += 1;
        continue;
      }
      if (r.status === "trashed") continue;
      const s = r.start_at ? new Date(r.start_at) : null;
      if (!s) continue;
      if (isInRange(s, smartRanges(now, "today")!)) counts.today += 1;
      if (isInRange(s, smartRanges(now, "tomorrow")!)) counts.tomorrow += 1;
      if (isInRange(s, smartRanges(now, "week")!)) counts.week += 1;
      if (isInRange(s, smartRanges(now, "month")!)) counts.month += 1;
    }
    return { boards, counts };
  }

  // --- habits ------------------------------------------------------------------

  async function listHabits(scope: SpaceScope, from?: string, to?: string): Promise<HabitPayload[]> {
    const rows = await db
      .selectFrom("habit")
      .selectAll()
      .where("workspace_id", "=", scope.workspaceId)
      .orderBy("created_at")
      .execute();
    const scoped = scope.spaceIds.length ? rows.filter((h) => scope.spaceIds.includes(h.space_id)) : rows;
    if (!scoped.length) return [];
    const logRows = await db
      .selectFrom("habit_log")
      .selectAll()
      .where("habit_id", "in", scoped.map((h) => h.id))
      .execute();
    const byHabit = new Map<string, TwoDooDb["habit_log"][]>();
    for (const log of logRows) {
      const list = byHabit.get(log.habit_id) ?? [];
      list.push(log);
      byHabit.set(log.habit_id, list);
    }
    return scoped.map((h) => {
      const logs = (byHabit.get(h.id) ?? [])
        .filter((l) => (!from || l.log_date >= from) && (!to || l.log_date <= to))
        .sort((a, b) => a.log_date.localeCompare(b.log_date));
      const payloadLogs = logs.map(rowToHabitLog);
      return {
        id: h.id,
        name: h.name,
        color: h.color,
        icon: h.icon,
        schedule: h.schedule,
        intervalDays: h.interval_days,
        byWeekday: h.by_weekday,
        targetCount: h.target_count,
        goalStreak: h.goal_streak,
        direction: h.direction,
        createdAt: iso(h.created_at)!,
        updatedAt: iso(h.updated_at)!,
        logs: payloadLogs,
        streak: computeStreak(h, logs),
        bestStreak: computeBestStreak(h, logs),
        totalCheckIns: logs.reduce((n, l) => n + l.count, 0),
      };
    });
  }

  interface CreateHabitInput {
    spaceId: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    schedule?: HabitSchedule;
    intervalDays?: number | null;
    byWeekday?: number[] | null;
    targetCount?: number;
    goalStreak?: number | null;
    direction?: HabitDirection;
  }

  async function createHabit(scope: SpaceScope, input: CreateHabitInput): Promise<HabitPayload | null> {
    const id = `hbt_${ulid()}`;
    await db.insertInto("habit").values({
      id,
      workspace_id: scope.workspaceId,
      space_id: input.spaceId,
      name: input.name,
      color: input.color ?? null,
      icon: input.icon ?? null,
      schedule: input.schedule ?? "daily",
      interval_days: input.intervalDays ?? null,
      by_weekday: input.byWeekday ?? null,
      target_count: input.targetCount ?? 1,
      goal_streak: input.goalStreak ?? null,
      direction: input.direction ?? "build",
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();
    const habits = await listHabits(scope);
    return habits.find((h) => h.id === id) ?? null;
  }

  async function updateHabit(scope: SpaceScope, id: string, patch: Partial<CreateHabitInput> & { archived?: boolean }): Promise<HabitPayload | null> {
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.color !== undefined) values.color = patch.color;
    if (patch.icon !== undefined) values.icon = patch.icon;
    if (patch.schedule !== undefined) values.schedule = patch.schedule;
    if (patch.intervalDays !== undefined) values.interval_days = patch.intervalDays;
    if (patch.byWeekday !== undefined) values.by_weekday = patch.byWeekday;
    if (patch.targetCount !== undefined) values.target_count = patch.targetCount;
    if (patch.goalStreak !== undefined) values.goal_streak = patch.goalStreak;
    if (patch.direction !== undefined) values.direction = patch.direction;
    if (patch.archived !== undefined) values.archived_at = patch.archived ? new Date().toISOString() : null;
    await db.updateTable("habit").set(values).where("id", "=", id).where("workspace_id", "=", scope.workspaceId).execute();
    const habits = await listHabits(scope);
    return habits.find((h) => h.id === id) ?? null;
  }

  async function deleteHabit(scope: SpaceScope, id: string): Promise<boolean> {
    const rows = await db.deleteFrom("habit").where("id", "=", id).where("workspace_id", "=", scope.workspaceId).returning("id").execute();
    await db.deleteFrom("habit_log").where("habit_id", "=", id).execute();
    return rows.length > 0;
  }

  async function logHabit(scope: SpaceScope, habitId: string, date: string, delta: number): Promise<HabitLogPayload | null> {
    const habit = await db.selectFrom("habit").selectAll().where("id", "=", habitId).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
    if (!habit) return null;
    const existing = await db.selectFrom("habit_log").selectAll().where("habit_id", "=", habitId).where("log_date", "=", date).executeTakeFirst();
    if (existing) {
      const count = Math.max(0, existing.count + delta);
      if (count === 0) {
        await db.deleteFrom("habit_log").where("id", "=", existing.id).execute();
        return null;
      }
      const row = await db.updateTable("habit_log").set({ count }).where("id", "=", existing.id).returningAll().executeTakeFirst();
      return row ? rowToHabitLog(row) : null;
    }
    if (delta <= 0) return null;
    const id = `hlg_${ulid()}`;
    const row = { id, workspace_id: scope.workspaceId, habit_id: habitId, log_date: date, count: delta, note: null, created_at: new Date().toISOString() };
    await db.insertInto("habit_log").values(row).execute();
    return rowToHabitLog(row);
  }

  // seed a default board/list on first use per space
  async function ensureDefaultStructure(scope: SpaceScope, spaceId: string): Promise<void> {
    const existing = await db.selectFrom("board").select("id").where("space_id", "=", spaceId).where("workspace_id", "=", scope.workspaceId).executeTakeFirst();
    if (existing) return;
    const board = await createBoard(scope, { spaceId, name: "Personal" });
    if (board) await createList(scope, { boardId: board.id, name: "Inbox" });
  }

  return {
    listTags,
    ensureTag,
    updateTag,
    deleteTag,
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    reorderTasks,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    listBoards,
    createBoard,
    updateBoard,
    deleteBoard,
    createList,
    updateList,
    deleteList,
    overview,
    listHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    logHabit,
    ensureDefaultStructure,
  };
}

// --- row mappers + streak math (module-level pure helpers) ----------------------

function rowToTag(r: { id: string; name: string; color: string | null; created_at: Date | string }): TagPayload {
  return { id: r.id, name: r.name, color: r.color, createdAt: iso(r.created_at)! };
}

function rowToChecklist(r: { id: string; task_id: string; content: string; checked: boolean; position: number }): ChecklistItemPayload {
  return { id: r.id, taskId: r.task_id, content: r.content, checked: r.checked, position: r.position };
}

function rowToHabitLog(r: { id: string; habit_id: string; log_date: string; count: number; note: string | null }): HabitLogPayload {
  return { id: r.id, habitId: r.habit_id, date: r.log_date, count: r.count, note: r.note };
}

function isInRange(d: Date, range: { start: Date; end: Date }): boolean {
  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}

/** Local-day boundaries of each smart list relative to `now`. */
export function smartRanges(now: Date, smart?: SmartList): { start: Date; end: Date; includeOverdue: boolean } | null {
  if (!smart || smart === "all" || smart === "completed") return null;
  const sod = (d: Date) => {
    const c = new Date(d.getTime());
    c.setHours(0, 0, 0, 0);
    return c;
  };
  const eod = (d: Date) => {
    const c = new Date(d.getTime());
    c.setHours(23, 59, 59, 999);
    return c;
  };
  const today = sod(now);
  switch (smart) {
    case "today":
      return { start: today, end: eod(now), includeOverdue: true };
    case "tomorrow": {
      const t = new Date(today.getTime());
      t.setDate(t.getDate() + 1);
      return { start: t, end: eod(t), includeOverdue: false };
    }
    case "week": {
      // Monday-start week (TickTick default)
      const monday = new Date(today.getTime());
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const sunday = new Date(monday.getTime());
      sunday.setDate(sunday.getDate() + 6);
      return { start: monday, end: eod(sunday), includeOverdue: true };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: first, end: last, includeOverdue: true };
    }
  }
}

/** Days the habit is scheduled for, as a set of weekday numbers (daily/interval → null = every day). */
function scheduledDays(h: TwoDooDb["habit"]): number[] | null {
  if (h.schedule === "weekly") return h.by_weekday?.length ? h.by_weekday : null;
  return null;
}

function dayMet(h: TwoDooDb["habit"], logs: TwoDooDb["habit_log"][], date: string): boolean {
  const total = logs.filter((l) => l.log_date === date).reduce((n, l) => n + l.count, 0);
  return total >= h.target_count;
}

/** Current streak of consecutive scheduled days met, counting back from today (or the last scheduled day). */
function computeStreak(h: TwoDooDb["habit"], logs: TwoDooDb["habit_log"][]): number {
  const days = scheduledDays(h);
  const met = new Set(logs.filter((l) => dayMet(h, logs, l.log_date)).map((l) => l.log_date));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  // today counts if met; otherwise streak survives until yesterday (TickTick behavior)
  for (let i = 0; i < 3660; i++) {
    const key = toDayKey(cursor);
    if (days === null || days.includes(cursor.getDay())) {
      if (met.has(key)) streak += 1;
      else if (i > 0) break; // a scheduled day missed in the past ends the streak
      else if (!met.has(key)) {
        // today not yet done — keep looking back, don't break yet
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeBestStreak(h: TwoDooDb["habit"], logs: TwoDooDb["habit_log"][]): number {
  const days = scheduledDays(h);
  const met = logs.filter((l) => dayMet(h, logs, l.log_date)).map((l) => l.log_date).sort();
  if (!met.length) return 0;
  let best = 1;
  let run = 1;
  let prev = new Date(`${met[0]}T00:00:00`);
  for (let i = 1; i < met.length; i++) {
    const cur = new Date(`${met[i]}T00:00:00`);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    let consecutive = diffDays === 1;
    if (days !== null) {
      // consecutive if all scheduled days between prev and cur are met — approximate by checking gaps
      let missing = false;
      const probe = new Date(prev.getTime());
      probe.setDate(probe.getDate() + 1);
      while (probe < cur) {
        if (days.includes(probe.getDay()) && !met.includes(toDayKey(probe))) missing = true;
        probe.setDate(probe.getDate() + 1);
      }
      consecutive = !missing;
    }
    if (consecutive) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function findBoard(boards: BoardPayload[], id: string): BoardPayload | null {
  for (const b of boards) {
    if (b.id === id) return b;
    const hit = findBoard(b.children, id);
    if (hit) return hit;
  }
  return null;
}
