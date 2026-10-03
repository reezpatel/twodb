import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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

export interface NoteRecord {
  noteId: string;
  content: { text?: string; doc?: unknown } & Record<string, unknown>;
  preview: string;
  createdAt: string;
  updatedAt: string;
  props: Record<string, unknown>;
}

interface NotesPayload {
  notes: NoteRecord[];
  columns: NoteProperty[];
  views: NoteView[];
}

type ViewHook = ReturnType<typeof useNotesView>;

export function useNotesView(groupId: string | null) {
  const queryClient = useQueryClient();
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notes", "group", groupId] });
  };

  const payload = useQuery({
    queryKey: ["notes", "group", groupId],
    queryFn: () => api<NotesPayload>(`/api/notes/groups/${groupId}/notes`),
    enabled: !!groupId,
  });

  const views = payload.data?.views ?? [];
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0] ?? null;

  const createNote = useMutation({
    mutationFn: ({ text, props }: { text?: string; props?: Record<string, unknown> }) =>
      api<{ noteId: string }>(`/api/notes/groups/${groupId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: { text: text ?? "" }, preview: (text ?? "").slice(0, 120), ...(props ? { props } : {}) }),
      }),
    onSuccess: invalidate,
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, content, preview, props }: { noteId: string; content?: unknown; preview?: string; props?: Record<string, unknown> }) =>
      api(`/api/notes/groups/${groupId}/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(content !== undefined ? { content } : {}),
          ...(preview !== undefined ? { preview } : {}),
          ...(props !== undefined ? { props } : {}),
        }),
      }),
    onSuccess: invalidate,
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => api(`/api/notes/groups/${groupId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const DEFAULT_OPTIONS_BY_TYPE: Partial<Record<NotePropertyType, string[]>> = {
    status: ["To Do", "In Progress", "Completed"],
  };

  const addProperty = useMutation({
    mutationFn: ({ name, type, options }: { name: string; type: NotePropertyType; options?: string[] }) =>
      api<NoteProperty>(`/api/notes/groups/${groupId}/properties`, {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          ...(type === "select" || type === "multiselect" || type === "status"
            ? {
                options: (options ?? DEFAULT_OPTIONS_BY_TYPE[type] ?? []).map((v) => ({
                  id: crypto.randomUUID(),
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
      api(`/api/notes/groups/${groupId}/properties/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: invalidate,
  });

  const setPropertyType = useMutation({
    mutationFn: ({ id, type }: { id: string; type: NotePropertyType }) =>
      api(`/api/notes/groups/${groupId}/properties/${id}`, { method: "PATCH", body: JSON.stringify({ type }) }),
    onSuccess: invalidate,
  });

  const deleteProperty = useMutation({
    mutationFn: (id: string) => api(`/api/notes/groups/${groupId}/properties/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const setPropertyOptions = useMutation({
    mutationFn: ({ id, options }: { id: string; options: NotePropertyOption[] }) =>
      api(`/api/notes/groups/${groupId}/properties/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ options }),
      }),
    onSuccess: invalidate,
  });

  const updateView = useMutation({
    mutationFn: ({ id, groupBy }: { id: string; groupBy: string | null }) =>
      api(`/api/notes/groups/${groupId}/views/${id}`, { method: "PATCH", body: JSON.stringify({ groupBy }) }),
    onSuccess: invalidate,
  });

  const addView = useMutation({
    mutationFn: ({ type }: { type: NoteViewType }) => api<NoteView>(`/api/notes/groups/${groupId}/views`, { method: "POST", body: JSON.stringify({ type }) }),
    onSuccess: (view) => {
      invalidate();
      setActiveViewId(view.id);
    },
  });

  const deleteView = useMutation({
    mutationFn: (id: string) => api(`/api/notes/groups/${groupId}/views/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      invalidate();
      if (activeViewId === id) setActiveViewId(null);
    },
  });

  return {
    payload,
    views,
    activeView,
    setActiveViewId,
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
