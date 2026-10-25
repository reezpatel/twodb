import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { apiFetch, assetUrl } from "@/lib/native";

/** Notion model: sections hold pages and databases; pages nest pages and
 *  databases; database rows are pages (kept out of the sidebar). */
export type NoteKind = "section" | "page" | "database";

export interface TreeNode {
  id: string;
  parentId: string | null;
  kind: NoteKind;
  title: string;
  icon: string | null;
  inline: boolean;
  position: number;
  isFavorite: boolean;
  /** A database row page (only present in the tree when starred). */
  isRow: boolean;
  /** Database whose parent page was deleted, or inline database whose block
   *  was removed from its page — listed at the bottom of the sidebar. */
  dangling: boolean;
  updatedAt: string;
}

export interface NodeDetail extends Omit<TreeNode, "dangling"> {
  cover: string | null;
  content: { doc?: unknown } | null;
  preview: string;
  deletedAt: string | null;
  createdAt: string;
  ancestors: { id: string; kind: NoteKind; title: string; icon: string | null }[];
  childCount: number;
  /** Empty page (no content, no children) — the only state that may turn
   *  into a database. */
  isEmpty: boolean;
}

export interface NodePatch {
  title?: string;
  icon?: string | null;
  cover?: string | null;
  content?: unknown;
  preview?: string;
  isFavorite?: boolean;
  parentId?: string;
  position?: number;
}

export const TREE_KEY = ["notes", "tree"] as const;
export const nodeKey = (id: string | null) => ["notes", "node", id] as const;

export function useNotesScene(opts: { selectedId?: string | null; onSelect?: (id: string | null) => void } = {}) {
  const queryClient = useQueryClient();
  const { selectedId = null, onSelect = () => {} } = opts;

  const invalidateTree = () => void queryClient.invalidateQueries({ queryKey: TREE_KEY });
  const invalidateNode = (id: string) => void queryClient.invalidateQueries({ queryKey: nodeKey(id) });

  const tree = useQuery({
    queryKey: TREE_KEY,
    queryFn: () => api<{ nodes: TreeNode[] }>("/api/notes/tree"),
  });

  const createSection = useMutation({
    mutationFn: (title?: string) => api<TreeNode>("/api/notes/sections", { method: "POST", body: JSON.stringify(title ? { title } : {}) }),
    onSuccess: invalidateTree,
  });

  /** New page (or database) under a section/page; opens it unless `inline`
   *  (inline databases are embedded by the editor that created them). */
  const createNode = useMutation({
    mutationFn: ({ parentId, kind = "page", inline = false, title }: { parentId: string; kind?: "page" | "database"; inline?: boolean; title?: string }) =>
      api<TreeNode>("/api/notes/nodes", { method: "POST", body: JSON.stringify({ parentId, kind, inline, ...(title ? { title } : {}) }) }),
    onSuccess: (row, vars) => {
      if (vars.inline) return; // tree refresh happens once the block is saved into the page
      invalidateTree();
      onSelect(row.id);
    },
  });

  const updateNode = useMutation({
    mutationFn: ({ id, ...patch }: NodePatch & { id: string }) => api<TreeNode>(`/api/notes/nodes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (_row, vars) => {
      // content autosaves don't change the sidebar; everything else might
      const keys = Object.keys(vars).filter((k) => k !== "id");
      if (keys.some((k) => k !== "content" && k !== "preview")) invalidateTree();
      invalidateNode(vars.id);
    },
  });

  const convertToDatabase = useMutation({
    mutationFn: (id: string) => api(`/api/notes/nodes/${id}/convert`, { method: "POST", body: "{}" }),
    onSuccess: (_r, id) => {
      invalidateTree();
      invalidateNode(id);
    },
  });

  const deleteNode = useMutation({
    mutationFn: (id: string) => api(`/api/notes/nodes/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => {
      invalidateTree();
      invalidateNode(id);
      void queryClient.invalidateQueries({ queryKey: ["notes", "databases"] });
      if (selectedId === id) onSelect(null);
    },
  });

  const restoreNode = useMutation({
    mutationFn: (id: string) => api(`/api/notes/nodes/${id}/restore`, { method: "POST" }),
    onSuccess: (_r, id) => {
      invalidateTree();
      invalidateNode(id);
      void queryClient.invalidateQueries({ queryKey: ["notes", "databases"] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) => api(`/api/notes/nodes/${id}`, { method: "PATCH", body: JSON.stringify({ isFavorite }) }),
    onSuccess: (_r, vars) => {
      invalidateTree();
      invalidateNode(vars.id);
      void queryClient.invalidateQueries({ queryKey: ["notes", "databases"] });
    },
  });

  /** Renumber siblings (ordered ids). */
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api("/api/notes/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: invalidateTree,
  });

  return {
    tree,
    selectedId,
    select: onSelect,
    invalidateTree,
    createSection,
    createNode,
    updateNode,
    convertToDatabase,
    deleteNode,
    restoreNode,
    toggleFavorite,
    reorder,
  };
}

export type NotesHook = ReturnType<typeof useNotesScene>;

/** Full node (page content / database meta + breadcrumbs). */
export function useNode(id: string | null) {
  return useQuery({
    queryKey: nodeKey(id),
    queryFn: () => api<NodeDetail>(`/api/notes/nodes/${id}`),
    enabled: !!id,
  });
}

export interface DatabaseSummary {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  inline: boolean;
  isFavorite: boolean;
  deletedAt: string | null;
  updatedAt: string;
  parentTitle: string | null;
  parentKind: NoteKind | null;
  rowCount: number;
  dangling: boolean;
}

export function useAllDatabases() {
  return useQuery({
    queryKey: ["notes", "databases"],
    queryFn: () => api<{ databases: DatabaseSummary[] }>("/api/notes/databases"),
  });
}

/** Asset uri (https resolve URL, or legacy twodb://) → fetchable URL. */
export function assetPreviewUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (uri.includes("/api/storage/resolve/")) return assetUrl(uri);
  const id = /^twodb:\/\/(?:[^/]+\/)?([A-Za-z0-9-_.]+)$/.exec(uri)?.[1];
  return id ? assetUrl(`/api/notes/assets/${id}`) : null;
}

/** Upload an image for a node (cover/icon/in-page). Resolves the twodb:// uri. */
export async function uploadNodeAsset(nodeId: string, file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await apiFetch(`/api/notes/nodes/${nodeId}/assets`, { method: "POST", body });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    const message = err?.error ?? "upload failed";
    throw new Error(message.includes("not_configured") ? `${message} — configure Notes Storage in Settings → Storage` : message);
  }
  return ((await res.json()) as { uri: string }).uri;
}
