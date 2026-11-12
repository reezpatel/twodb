// Typed client over Garden's API, served behind the Gateway at /apps/garden
// (Vite proxies in dev). Session cookies carry auth; the active space rides
// along as `x-garden-space`.
import type {
  DatabaseDetail,
  Field,
  FieldConfig,
  FilterGroup,
  QueryResult,
  RecordDetail,
  RecordRef,
  SearchHit,
  SortSpec,
  TrashItem,
  TreeNode,
  UserFieldType,
  View,
  ViewConfig,
  ViewType,
} from "@shared/model";

export const API_BASE = (import.meta.env.VITE_GARDEN_API as string | undefined) ?? "/apps/garden";
const SPACE_KEY = "garden.space";

let activeSpace: string | null = localStorage.getItem(SPACE_KEY);
export const getSpace = () => activeSpace;
export function setSpace(id: string) {
  activeSpace = id;
  localStorage.setItem(SPACE_KEY, id);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown, extra?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (activeSpace) headers["x-garden-space"] = activeSpace;
  if (body !== undefined && !(body instanceof Blob)) headers["content-type"] = "application/json";
  const res = await fetch(API_BASE + path, {
    method,
    credentials: "include",
    ...extra,
    headers: { ...headers, ...(extra?.headers as Record<string, string> | undefined) },
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(res.status, j.error ?? "error", j.message ?? j.error ?? `${res.status}`);
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

export interface RecordPatch {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  content?: Record<string, unknown>;
  config?: { fullWidth?: boolean };
  isFavorite?: boolean;
  parentId?: string | null;
  position?: number;
}

export interface RowQueryInput {
  viewId?: string;
  filter?: FilterGroup | null;
  sorts?: SortSpec[];
  search?: string;
  limit?: number;
}

export const api = {
  tree: () => req<{ nodes: TreeNode[]; favorites: TreeNode[]; defaultDatabaseId: string }>("GET", "/tree"),
  children: (id: string) => req<{ nodes: TreeNode[] }>("GET", `/records/${id}/children`),
  record: (id: string) => req<RecordDetail>("GET", `/records/${id}`),
  createPage: (b: { parentId?: string | null; title?: string; values?: Record<string, unknown>; content?: Record<string, unknown> }) =>
    req<RecordDetail>("POST", "/pages", b),
  createDatabase: (b: { parentId?: string | null; title?: string; inline?: boolean }) => req<DatabaseDetail>("POST", "/databases", b),
  patchRecord: (id: string, b: RecordPatch) => req<{ ok: true }>("PATCH", `/records/${id}`, b),
  setValues: (id: string, values: Record<string, unknown>) => req<RecordDetail>("PATCH", `/records/${id}/values`, { values }),
  trash: (id: string) => req<{ ok: true }>("DELETE", `/records/${id}`),
  restore: (id: string) => req<{ ok: true }>("POST", `/records/${id}/restore`),
  deleteForever: (id: string) => req<{ ok: true }>("DELETE", `/records/${id}/permanent`),
  backlinks: (id: string) => req<{ backlinks: (RecordRef & { snippet: string })[] }>("GET", `/records/${id}/backlinks`),
  database: (id: string) => req<DatabaseDetail>("GET", `/databases/${id}`),
  query: (id: string, q: RowQueryInput) => req<QueryResult>("POST", `/databases/${id}/query`, q),
  createField: (dbId: string, b: { name: string; type: UserFieldType; config?: FieldConfig; position?: number; twoWay?: boolean; reverseName?: string }) =>
    req<Field>("POST", `/databases/${dbId}/fields`, b),
  patchField: (id: string, b: { name?: string; type?: UserFieldType; config?: FieldConfig; position?: number }) => req<Field>("PATCH", `/fields/${id}`, b),
  deleteField: (id: string) => req<{ ok: true }>("DELETE", `/fields/${id}`),
  createView: (dbId: string, b: { name: string; type: ViewType; config?: ViewConfig }) => req<View>("POST", `/databases/${dbId}/views`, b),
  patchView: (id: string, b: { name?: string; type?: ViewType; config?: ViewConfig; position?: number }) => req<View>("PATCH", `/views/${id}`, b),
  duplicateView: (id: string) => req<View>("POST", `/views/${id}/duplicate`),
  deleteView: (id: string) => req<{ ok: true }>("DELETE", `/views/${id}`),
  search: (q: string, opts: { databaseId?: string; kind?: "page" | "database"; limit?: number } = {}) => {
    const p = new URLSearchParams({ q });
    if (opts.databaseId) p.set("databaseId", opts.databaseId);
    if (opts.kind) p.set("kind", opts.kind);
    if (opts.limit) p.set("limit", String(opts.limit));
    return req<{ hits: SearchHit[] }>("GET", `/search?${p}`);
  },
  trashList: () => req<{ items: TrashItem[] }>("GET", "/trash"),
  emptyTrash: () => req<{ ok: true }>("DELETE", "/trash"),
  upload: (file: File, recordId?: string) =>
    req<{ id: string; url: string }>("POST", `/assets${recordId ? `?recordId=${recordId}` : ""}`, file, {
      headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
    }),
};

// --- control plane (gateway) ------------------------------------------------

export interface Space {
  id: string;
  name: string;
}
export interface Member {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export const gateway = {
  session: () => fetch("/api/auth/get-session", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)) as Promise<{ user?: { id: string; name?: string } } | null>,
  spaces: () => fetch("/registry/spaces", { credentials: "include" }).then((r) => (r.ok ? r.json() : { spaces: [] })) as Promise<{ spaces: Space[] }>,
  members: () => fetch("/registry/members", { credentials: "include" }).then((r) => (r.ok ? r.json() : { members: [], me: null })) as Promise<{ members: Member[]; me: string | null }>,
};
