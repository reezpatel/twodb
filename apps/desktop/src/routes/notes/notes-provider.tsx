import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useNotesScene, type NoteFolder, type NoteGroup } from "./use-notes-scene";
import { useMediaQuery } from "@/lib/use-media-query";
import { Sidebar } from "./scene/sidebar";

interface NotesState {
  notes: ReturnType<typeof useNotesScene>;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  createView: { sectionId: string; parentId: string | null; parentName: string } | null;
  openCreate: (sectionId: string, parentId: string | null, parentName: string) => void;
  closeCreate: () => void;
  groupFromUrl: string | null;
  noteFromUrl: string | null;
  /** Mobile never opens the side editor — note clicks go to the full page. */
  isMobile: boolean;
  setSelectedGroupId: (id: string | null) => void;
  setOpenNoteId: (id: string | null) => void;
}

/** Notes scene state — owned here so the shell-rendered sidenav and the
 * content share one instance. URL still drives the selected group/note. */
export const NotesContext = createContext<NotesState | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 1023px)");
  // /apps/notes/:groupId/:noteId — params come from the path since this
  // provider renders above the route element.
  const [, , , groupId, noteId] = location.pathname.split("/");
  const groupFromUrl = groupId ?? null;
  const noteFromUrl = noteId ?? null;

  const setSelectedGroupId = useCallback(
    (id: string | null) => {
      navigate(id ? `/apps/notes/${id}` : "/apps/notes", { replace: true });
    },
    [navigate],
  );

  const setOpenNoteId = useCallback(
    (id: string | null) => {
      if (!groupFromUrl) return;
      // Mobile: opening a note navigates to the full page instead of the
      // side-by-side editor (too cramped). Closing returns to the group.
      if (id && isMobile) {
        navigate(`/apps/notes/${groupFromUrl}/${id}/page`);
        return;
      }
      navigate(id ? `/apps/notes/${groupFromUrl}/${id}` : `/apps/notes/${groupFromUrl}`, { replace: true });
    },
    [navigate, groupFromUrl, isMobile],
  );

  const notes = useNotesScene({ selectedGroupId: groupFromUrl, onSelectGroupId: setSelectedGroupId });
  const scrollRoot = useRef<HTMLDivElement>(null);
  const [createView, setCreateView] = useState<{ sectionId: string; parentId: string | null; parentName: string } | null>(null);
  const openCreate = useCallback((sectionId: string, parentId: string | null, parentName: string) => setCreateView({ sectionId, parentId, parentName }), []);
  const closeCreate = useCallback(() => setCreateView(null), []);

  const value = useMemo(
    () => ({ notes, scrollRoot, createView, openCreate, closeCreate, groupFromUrl, noteFromUrl, isMobile, setSelectedGroupId, setOpenNoteId }),
    [notes, scrollRoot, createView, openCreate, closeCreate, groupFromUrl, noteFromUrl, isMobile, setSelectedGroupId, setOpenNoteId],
  );
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used within NotesProvider");
  return ctx;
}

/** The notes sidebar (sections tree) — rendered by the app shell
 * (desktop column / mobile drawer). */
export function NotesSidenav() {
  const { notes, scrollRoot, openCreate } = useNotes();

  return <Sidebar notes={notes} scrollRoot={scrollRoot} onCreate={openCreate} />;
}

export type { NoteFolder, NoteGroup };
