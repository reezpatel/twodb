import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { twodooApi, type Board, type Habit, type SmartListKey, type Tag, type Task, type TaskList } from "../../../lib/twoodoo-client";
import { parseQuickAdd } from "../../../lib/quick-add";
import { toDayKey } from "../../../lib/dates";

/**
 * App-level TwoDoo state — the "holding hook" per blocks/CONVENTIONS.md.
 * Owns: overview (boards+counts), tasks of the current view, tags, habits,
 * and every mutation with optimistic-ish refresh. Views stay dumb-ish.
 */

export type ViewKind =
  | { kind: "home" }
  | { kind: "board"; boardId: string }
  | { kind: "list"; listId: string }
  | { kind: "smart"; smart: SmartListKey }
  | { kind: "calendar" }
  | { kind: "habits" }
  | { kind: "tag"; tagId: string };

interface TwoDooState {
  loading: boolean;
  error: string | null;
  view: ViewKind;
  setView: (v: ViewKind) => void;
  boards: Board[];
  counts: { today: number; tomorrow: number; week: number; month: number; all: number; completed: number } | null;
  tasks: Task[];
  tags: Tag[];
  habits: Habit[];
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  activeTask: Task | null;
  spaces: { id: string; name: string }[];
  search: string;
  setSearch: (q: string) => void;
  refresh: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  // mutations
  quickAdd: (raw: string, targetListId: string) => Promise<void>;
  createBoard: (name: string, spaceId: string, parentId?: string | null) => Promise<void>;
  createList: (boardId: string, name: string) => Promise<void>;
  renameBoard: (id: string, name: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  updateTask: (id: string, patch: Record<string, unknown>) => Promise<void>;
  trashTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  deleteTaskForever: (id: string) => Promise<void>;
  reorderTask: (taskId: string, beforeId: string | null, afterId: string | null, listId?: string) => Promise<void>;
  addChecklistItem: (taskId: string, content: string) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemId: string, checked: boolean) => Promise<void>;
  deleteChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  createHabit: (name: string) => Promise<void>;
  checkInHabit: (habitId: string, date: string, delta: number) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
}

const TwoDooContext = createContext<TwoDooState | null>(null);

export function useTwoDoo(): TwoDooState {
  const ctx = useContext(TwoDooContext);
  if (!ctx) throw new Error("useTwoDoo must be used inside <TwoDooProvider>");
  return ctx;
}

function collectListNames(boards: Board[]): string[] {
  const names: string[] = [];
  const walk = (b: Board) => {
    names.push(b.name);
    for (const l of b.lists) names.push(l.name);
    b.children.forEach(walk);
  };
  boards.forEach(walk);
  return names;
}

function collectLists(boards: Board[]): TaskList[] {
  const out: TaskList[] = [];
  const walk = (b: Board) => {
    out.push(...b.lists);
    b.children.forEach(walk);
  };
  boards.forEach(walk);
  return out;
}

function findBoard(boards: Board[], id: string): Board | null {
  for (const b of boards) {
    if (b.id === id) return b;
    const hit = findBoard(b.children, id);
    if (hit) return hit;
  }
  return null;
}

export function TwoDooProvider(props: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewKind>({ kind: "home" });
  const [boards, setBoards] = useState<Board[]>([]);
  const [counts, setCounts] = useState<TwoDooState["counts"]>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const spaces = useMemo(() => {
    const seen = new Map<string, string>();
    const walk = (b: Board) => seen.set(b.spaceId, b.spaceId);
    boards.forEach(walk);
    return [...seen.keys()].map((id) => ({ id, name: id }));
  }, [boards]);

  const refresh = useCallback(async () => {
    try {
      const [overview, tagList] = await Promise.all([twodooApi.getOverview(), twodooApi.listTags()]);
      setBoards(overview.boards);
      setCounts(overview.counts);
      setTags(tagList);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const tasksQuery = useMemo(() => {
    if (search.trim()) return { q: search.trim(), status: "any" as const };
    switch (view.kind) {
      case "list":
        return { listId: view.listId };
      case "board":
        return { boardId: view.boardId };
      case "smart":
        return { smart: view.smart };
      case "tag":
        return { tagId: view.tagId, status: "open" as const };
      case "home":
      case "calendar":
      case "habits":
        return null;
    }
  }, [view, search]);

  const refreshTasks = useCallback(async () => {
    if (!tasksQuery) {
      setTasks([]);
      return;
    }
    try {
      const rows = await twodooApi.listTasks(tasksQuery);
      setTasks(rows);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [tasksQuery]);

  const refreshHabits = useCallback(async () => {
    try {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      setHabits(await twodooApi.listHabits(toDayKey(from), undefined));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([refresh(), refreshTasks(), refreshHabits()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks, search]);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId) ?? null, [tasks, activeTaskId]);

  // --- mutations -----------------------------------------------------------------

  const quickAdd = useCallback(
    async (raw: string, targetListId: string) => {
      const parsed = parseQuickAdd(raw, collectListNames(boards));
      if (!parsed.title) return;
      // "#name" that matched a list name reroutes the task
      const listRedirect = parsed.tags.find((t) => t.startsWith("@list:"));
      const tagNames = parsed.tags.filter((t) => !t.startsWith("@list:"));
      let listId = targetListId;
      if (listRedirect) {
        const name = listRedirect.slice(6).toLowerCase();
        const target = collectLists(boards).find((l) => l.name.toLowerCase() === name);
        if (target) listId = target.id;
      }
      await twodooApi.createTask({
        listId,
        title: parsed.title,
        priority: parsed.priority !== "none" ? parsed.priority : undefined,
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        allDay: parsed.allDay,
        recurrenceRule: parsed.recurrenceRule,
        tagNames: tagNames.length ? tagNames : undefined,
      });
      await Promise.all([refreshTasks(), refresh()]);
    },
    [boards, refresh, refreshTasks],
  );

  const createBoard = useCallback(
    async (name: string, spaceId: string, parentId?: string | null) => {
      await twodooApi.createBoard({ name, spaceId, parentId: parentId ?? null });
      await refresh();
    },
    [refresh],
  );

  const createList = useCallback(
    async (boardId: string, name: string) => {
      await twodooApi.createList({ boardId, name });
      await refresh();
    },
    [refresh],
  );

  const renameBoard = useCallback(
    async (id: string, name: string) => {
      await twodooApi.updateBoard(id, { name });
      await refresh();
    },
    [refresh],
  );

  const deleteBoard = useCallback(
    async (id: string) => {
      await twodooApi.deleteBoard(id);
      setView((v) => (v.kind === "board" && v.boardId === id ? { kind: "home" } : v));
      await refresh();
    },
    [refresh],
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      await twodooApi.updateList(id, { name });
      await refresh();
    },
    [refresh],
  );

  const deleteList = useCallback(
    async (id: string) => {
      await twodooApi.deleteList(id);
      setView((v) => (v.kind === "list" && v.listId === id ? { kind: "home" } : v));
      await refresh();
    },
    [refresh],
  );

  const toggleTask = useCallback(
    async (task: Task) => {
      const res = await twodooApi.completeTask(task.id, task.status !== "done");
      setTasks((prev) => prev.map((t) => (t.id === res.task.id ? res.task : t)));
      if (res.spawned) await refreshTasks();
      await refresh();
    },
    [refresh, refreshTasks],
  );

  const updateTask = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const updated = await twodooApi.updateTask(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      await refresh();
    },
    [refresh],
  );

  const trashTask = useCallback(
    async (id: string) => {
      await twodooApi.updateTask(id, { status: "trashed" });
      await Promise.all([refreshTasks(), refresh()]);
    },
    [refresh, refreshTasks],
  );

  const restoreTask = useCallback(
    async (id: string) => {
      await twodooApi.updateTask(id, { status: "open" });
      await Promise.all([refreshTasks(), refresh()]);
    },
    [refresh, refreshTasks],
  );

  const deleteTaskForever = useCallback(
    async (id: string) => {
      await twodooApi.deleteTask(id);
      setActiveTaskId(null);
      await Promise.all([refreshTasks(), refresh()]);
    },
    [refresh, refreshTasks],
  );

  const reorderTask = useCallback(
    async (taskId: string, beforeId: string | null, afterId: string | null, listId?: string) => {
      await twodooApi.reorderTask({ taskId, beforeId, afterId, listId });
      await refreshTasks();
    },
    [refreshTasks],
  );

  const addChecklistItem = useCallback(async (taskId: string, content: string) => {
    const item = await twodooApi.addChecklistItem(taskId, content);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, checklist: [...t.checklist, item], checklistTotal: t.checklistTotal + 1 }
          : t,
      ),
    );
  }, []);

  const toggleChecklistItem = useCallback(async (taskId: string, itemId: string, checked: boolean) => {
    const item = await twodooApi.updateChecklistItem(itemId, { checked });
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const checklist = t.checklist.map((c) => (c.id === itemId ? item : c));
        return { ...t, checklist, checklistDone: checklist.filter((c) => c.checked).length };
      }),
    );
  }, []);

  const deleteChecklistItem = useCallback(async (taskId: string, itemId: string) => {
    await twodooApi.deleteChecklistItem(itemId);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const checklist = t.checklist.filter((c) => c.id !== itemId);
        return { ...t, checklist, checklistTotal: checklist.length, checklistDone: checklist.filter((c) => c.checked).length };
      }),
    );
  }, []);

  const createHabit = useCallback(
    async (name: string) => {
      const spaceId = boards[0]?.spaceId;
      if (!spaceId) return;
      await twodooApi.createHabit({ spaceId, name });
      await refreshHabits();
    },
    [boards, refreshHabits],
  );

  const checkInHabit = useCallback(
    async (habitId: string, date: string, delta: number) => {
      await twodooApi.logHabit(habitId, date, delta);
      await refreshHabits();
    },
    [refreshHabits],
  );

  const deleteHabit = useCallback(
    async (habitId: string) => {
      await twodooApi.deleteHabit(habitId);
      await refreshHabits();
    },
    [refreshHabits],
  );

  const setViewAndReset = useCallback((v: ViewKind) => {
    setActiveTaskId(null);
    setView(v);
  }, []);

  const value: TwoDooState = {
    loading,
    error,
    view,
    setView: setViewAndReset,
    boards,
    counts,
    tasks,
    tags,
    habits,
    activeTaskId,
    setActiveTaskId,
    activeTask,
    spaces,
    search,
    setSearch,
    refresh,
    refreshTasks,
    quickAdd,
    createBoard,
    createList,
    renameBoard,
    deleteBoard,
    renameList,
    deleteList,
    toggleTask,
    updateTask,
    trashTask,
    restoreTask,
    deleteTaskForever,
    reorderTask,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    createHabit,
    checkInHabit,
    deleteHabit,
  };

  return <TwoDooContext.Provider value={value}>{props.children}</TwoDooContext.Provider>;
}

export { findBoard, collectLists };
