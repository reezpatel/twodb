import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import type { Board, BoardGroup } from "@shared/model";
import { paintressClient, type Space } from "../../lib/paintress-client";

export type SidebarTab = "diagram" | "doc";

/** Holding hook for Shell: the board list, the sidebar tab, and board mutations. */
export function useShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [creating, setCreating] = useState(false);
  const [tab, setTabState] = useState<SidebarTab>(() => (localStorage.getItem("paintress.sidebar.tab") === "doc" ? "doc" : "diagram"));
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("paintress.sidebar.open") !== "0");

  const setTab = useCallback((t: SidebarTab) => {
    setTabState(t);
    localStorage.setItem("paintress.sidebar.tab", t);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      localStorage.setItem("paintress.sidebar.open", v ? "0" : "1");
      return !v;
    });
  }, []);

  // Ctrl/Cmd+B toggles the sidebar (VS Code style), unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b" || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const refresh = useCallback(() => {
    paintressClient
      .listBoards()
      .then((r) => {
        setBoards(r.boards);
        setGroups(r.groups);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    refresh();
    paintressClient.listSpaces().then((r) => setSpaces(r.spaces)).catch(() => undefined);
    const t = setInterval(refresh, 15_000); // agents create boards too
    return () => clearInterval(t);
  }, [refresh]);

  const activeBoardId = location.pathname.match(/^\/b\/([^/]+)/)?.[1] ?? null;

  // Opening a board of the other kind (deep link) flips the sidebar tab to it.
  useEffect(() => {
    const b = boards?.find((x) => x.id === activeBoardId);
    if (b && b.kind !== tab) setTab(b.kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId, boards]);

  const visible = useMemo(() => boards?.filter((b) => b.kind === tab) ?? null, [boards, tab]);
  const counts = useMemo(
    () => ({ diagram: boards?.filter((b) => b.kind === "diagram").length ?? 0, doc: boards?.filter((b) => b.kind === "doc").length ?? 0 }),
    [boards],
  );

  const openBoard = useCallback((b: Board) => navigate(`/b/${b.id}`), [navigate]);
  const create = useCallback(
    async (input: { name: string; kind: SidebarTab; groupId?: string; groupName?: string; spaceId?: string }) => {
      const b = await paintressClient.createBoard(input);
      refresh();
      setCreating(false);
      navigate(`/b/${b.id}`);
    },
    [navigate, refresh],
  );
  const rename = useCallback(
    async (b: Board, name: string) => {
      await paintressClient.updateBoard(b.id, { name });
      refresh();
    },
    [refresh],
  );
  const remove = useCallback(
    async (b: Board) => {
      await paintressClient.deleteBoard(b.id);
      if (activeBoardId === b.id) navigate("/");
      refresh();
    },
    [activeBoardId, navigate, refresh],
  );

  return { boards, groups, spaces, tab, setTab, visible, counts, activeBoardId, creating, setCreating, openBoard, create, rename, remove, sidebarOpen, toggleSidebar };
}
