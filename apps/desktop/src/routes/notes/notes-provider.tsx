import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useNotesScene, type NotesHook } from "./use-notes-scene";
import { useMediaQuery } from "@/lib/use-media-query";
import { Sidebar } from "./scene/sidebar";

interface NotesState {
  notes: NotesHook;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  /** /apps/notes/:nodeId — the open page or database. */
  nodeFromUrl: string | null;
  /** /apps/notes/:databaseId/:rowId — row open in the side editor. */
  rowFromUrl: string | null;
  /** Mobile never opens the side editor — rows open as full pages. */
  isMobile: boolean;
  setOpenNoteId: (id: string | null) => void;
}

/** Notes scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. The URL drives the selected node/row. */
export const NotesContext = createContext<NotesState | null>(null);

/** Static first segments that aren't node ids. */
export const NOTES_STATIC_ROUTES = new Set(["databases"]);

export function NotesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  // params come from the path since this provider renders above the route element
  const [, , , first, second] = location.pathname.split("/");
  const nodeFromUrl = first && !NOTES_STATIC_ROUTES.has(first) ? first : null;
  const rowFromUrl = nodeFromUrl ? (second ?? null) : null;

  const select = useCallback((id: string | null) => navigate(id ? `/apps/notes/${id}` : "/apps/notes"), [navigate]);

  // Rows are pages: mobile opens them full-page; desktop slides in the side
  // editor over the database.
  const setOpenNoteId = useCallback(
    (id: string | null) => {
      if (!nodeFromUrl) return;
      if (id && isMobile) return navigate(`/apps/notes/${id}`);
      navigate(id ? `/apps/notes/${nodeFromUrl}/${id}` : `/apps/notes/${nodeFromUrl}`, { replace: true });
    },
    [navigate, nodeFromUrl, isMobile],
  );

  const notes = useNotesScene({ selectedId: nodeFromUrl, onSelect: select });
  const scrollRoot = useRef<HTMLDivElement>(null);

  const value = useMemo(
    () => ({ notes, scrollRoot, nodeFromUrl, rowFromUrl, isMobile, setOpenNoteId }),
    [notes, scrollRoot, nodeFromUrl, rowFromUrl, isMobile, setOpenNoteId],
  );
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}

/** The notes sidebar — rendered by the app shell (desktop column / mobile drawer). */
export function NotesSidenav() {
  const { notes, scrollRoot } = useNotes();
  return <Sidebar notes={notes} scrollRoot={scrollRoot} />;
}
