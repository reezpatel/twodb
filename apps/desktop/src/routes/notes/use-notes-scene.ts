import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export const NOTE_GROUP_TYPES = ["notes", "checklist", "table", "sheet", "canvas"] as const;
export type NoteGroupType = (typeof NOTE_GROUP_TYPES)[number];

export interface NoteSection {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolder {
  id: string;
  sectionId: string;
  parentId: string | null;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteGroup {
  id: string;
  folderId: string;
  name: string;
  type: NoteGroupType;
  position: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotesTree {
  sections: NoteSection[];
  folders: NoteFolder[];
  groups: NoteGroup[];
}

export type ReorderKind = "section" | "folder" | "group";

export interface UseNotesSceneOpts {
  /** Currently selected group id, owned by the caller (e.g. URL params). */
  selectedGroupId?: string | null;
  /** Notifies the caller of selection changes (e.g. URL setter). */
  onSelectGroupId?: (id: string | null) => void;
}

export function useNotesScene(opts: UseNotesSceneOpts = {}) {
  const queryClient = useQueryClient();
  const { selectedGroupId = null, onSelectGroupId = () => {} } = opts;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["notes", "tree"] });

  const tree = useQuery({
    queryKey: ["notes", "tree"],
    queryFn: () => api<NotesTree>("/api/notes/tree"),
  });

  const createSection = useMutation({
    mutationFn: (name?: string) => api<NoteSection>("/api/notes/sections", { method: "POST", body: JSON.stringify(name ? { name } : {}) }),
    onSuccess: invalidate,
  });

  const renameSection = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api(`/api/notes/sections/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const deleteSection = useMutation({
    mutationFn: (id: string) => api(`/api/notes/sections/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const createFolder = useMutation({
    mutationFn: ({ sectionId, parentId = null, name }: { sectionId: string; parentId?: string | null; name?: string }) =>
      api<NoteFolder>("/api/notes/folders", {
        method: "POST",
        body: JSON.stringify({ sectionId, parentId, ...(name ? { name } : {}) }),
      }),
    onSuccess: invalidate,
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api(`/api/notes/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const moveFolder = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      api(`/api/notes/folders/${id}`, { method: "PATCH", body: JSON.stringify({ parentId }) }),
    onSuccess: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => api(`/api/notes/folders/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const createGroup = useMutation({
    mutationFn: ({ folderId, type, name }: { folderId: string; type: NoteGroupType; name?: string }) =>
      api<NoteGroup>("/api/notes/groups", {
        method: "POST",
        body: JSON.stringify({ folderId, type, ...(name ? { name } : {}) }),
      }),
    onSuccess: (row) => {
      invalidate();
      onSelectGroupId(row.id);
    },
  });

  const renameGroup = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api(`/api/notes/groups/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const moveGroup = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string }) => api(`/api/notes/groups/${id}`, { method: "PATCH", body: JSON.stringify({ folderId }) }),
    onSuccess: invalidate,
  });

  const setGroupType = useMutation({
    mutationFn: ({ id, type }: { id: string; type: NoteGroupType }) => api(`/api/notes/groups/${id}`, { method: "PATCH", body: JSON.stringify({ type }) }),
    onSuccess: invalidate,
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      api(`/api/notes/groups/${id}`, { method: "PATCH", body: JSON.stringify({ isFavorite }) }),
    onSuccess: invalidate,
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api(`/api/notes/groups/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: ({ kind, ids }: { kind: ReorderKind; ids: string[] }) => api("/api/notes/reorder", { method: "POST", body: JSON.stringify({ kind, ids }) }),
    onSuccess: invalidate,
  });

  return {
    tree,
    selectedGroupId,
    setSelectedGroupId: onSelectGroupId,
    createSection,
    renameSection,
    deleteSection,
    createFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    createGroup,
    renameGroup,
    moveGroup,
    setGroupType,
    toggleFavorite,
    deleteGroup,
    reorder,
  };
}
