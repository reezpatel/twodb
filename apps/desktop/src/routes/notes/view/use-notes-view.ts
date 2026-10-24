import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { randomId } from "@/lib/utils";

export const NOTE_PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multiselect",
  "status",
  "date",
  "person",
  "files & media",
  "checkbox",
  "url",
  "phone",
  "email",
  "id",
  "place",
] as const;
export type NotePropertyType = (typeof NOTE_PROPERTY_TYPES)[number];

/** Subset exposed in the "Type" select / "Change type" submenu. The full
 * NotePropertyType list is supported by validation + cell registry; these are
 * just the ones the user picks from directly. */
export const SELECTABLE_PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multiselect",
  "status",
  "date",
  "checkbox",
  "url",
] as const satisfies readonly NotePropertyType[];

export const NOTE_VIEW_TYPES = ["table", "list", "kanban"] as const;
export type NoteViewType = (typeof NOTE_VIEW_TYPES)[number];

export interface NotePropertyOption {
  id: string;
  value: string;
  label?: string;
  color?: string;
  /** Group label (e.g. "Backlog", "Active", "Done") for status columns. */
  group?: string;
}

export interface NoteProperty {
  id: string;
  name: string;
  type: NotePropertyType;
  options?: NotePropertyOption[];
  validation?: { required?: boolean } & Record<string, unknown>;
}

export interface NoteView {
  id: string;
  name: string;
  type: NoteViewType;
  groupBy?: string | null;
  sorts?: { property: string; direction: "asc" | "desc" }[];
}

/** A database row — itself a page node (noteId = node id). */
export interface NoteRecord {
  noteId: string;
  title: string;
  icon: string | null;
  cover: string | null;
  isFavorite: boolean;
  content: { doc?: unknown } & Record<string, unknown>;
  preview: string;
  createdAt: string;
  updatedAt: string;
  props: Record<string, unknown>;
}

export interface RowPatch {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  content?: unknown;
  preview?: string;
  props?: Record<string, unknown>;
}

interface NotesPayload {
  notes: NoteRecord[];
  columns: NoteProperty[];
  views: NoteView[];
  /** Owning app/feature when the schema is locked (e.g. "twodb:shared_content"). */
  schemaLockedBy: string | null;
}

type ViewHook = ReturnType<typeof useNotesView>;

export function useNotesView(databaseId: string | null) {
  const queryClient = useQueryClient();
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notes", "database", databaseId] });
  };

  const payload = useQuery({
    queryKey: ["notes", "database", databaseId],
    queryFn: () => api<NotesPayload>(`/api/notes/databases/${databaseId}/rows`),
    enabled: !!databaseId,
  });

  const views = payload.data?.views ?? [];
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0] ?? null;

  const createNote = useMutation({
    mutationFn: ({ title, props }: { title?: string; props?: Record<string, unknown> } = {}) =>
      api<{ noteId: string }>(`/api/notes/databases/${databaseId}/rows`, {
        method: "POST",
        body: JSON.stringify({ ...(title ? { title } : {}), ...(props ? { props } : {}) }),
      }),
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, ...patch }: RowPatch & { noteId: string }) =>
      api(`/api/notes/databases/${databaseId}/rows/${noteId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api(`/api/notes/databases/${databaseId}/rows/${noteId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const DEFAULT_OPTIONS_BY_TYPE: Partial<Record<NotePropertyType, string[]>> = {
    status: ["To Do", "In Progress", "Completed"],
  };

  const addProperty = useMutation({
    mutationFn: ({ name, type, options }: { name: string; type: NotePropertyType; options?: string[] }) =>
      api<NoteProperty>(`/api/notes/databases/${databaseId}/properties`, {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          ...(type === "select" || type === "multiselect" || type === "status"
            ? {
                options: (options ?? DEFAULT_OPTIONS_BY_TYPE[type] ?? []).map((v) => ({
                  id: randomId(),
                  value: v,
                  label: v,
                })),
              }
            : {}),
        }),
      }),
    onSuccess: invalidate,
  });

  const renameProperty = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api(`/api/notes/databases/${databaseId}/properties/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const setPropertyType = useMutation({
    mutationFn: ({ id, type }: { id: string; type: NotePropertyType }) =>
      api(`/api/notes/databases/${databaseId}/properties/${id}`, { method: "PATCH", body: JSON.stringify({ type }) }),
    onSuccess: invalidate,
  });

  const deleteProperty = useMutation({
    mutationFn: (id: string) => api(`/api/notes/databases/${databaseId}/properties/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const setPropertyOptions = useMutation({
    mutationFn: ({ id, options }: { id: string; options: NotePropertyOption[] }) =>
      api(`/api/notes/databases/${databaseId}/properties/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ options }),
      }),
    onSuccess: invalidate,
  });

  const updateView = useMutation({
    mutationFn: ({ id, groupBy }: { id: string; groupBy: string | null }) =>
      api(`/api/notes/databases/${databaseId}/views/${id}`, { method: "PATCH", body: JSON.stringify({ groupBy }) }),
    onSuccess: invalidate,
  });

  const addView = useMutation({
    mutationFn: ({ type }: { type: NoteViewType }) => api<NoteView>(`/api/notes/databases/${databaseId}/views`, { method: "POST", body: JSON.stringify({ type }) }),
    onSuccess: (view) => {
      invalidate();
      setActiveViewId(view.id);
    },
  });

  const deleteView = useMutation({
    mutationFn: (id: string) => api(`/api/notes/databases/${databaseId}/views/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      invalidate();
      if (activeViewId === id) setActiveViewId(null);
    },
  });

  return {
    databaseId,
    payload,
    views,
    activeView,
    setActiveViewId,
    /** Owning app/feature when this database's schema is locked. */
    schemaLockedBy: payload.data?.schemaLockedBy ?? null,
    createNote,
    updateNote,
    deleteNote,
    addProperty,
    renameProperty,
    setPropertyType,
    deleteProperty,
    setPropertyOptions,
    updateView,
    addView,
    deleteView,
  };
}

export type NotesViewHook = ViewHook;
