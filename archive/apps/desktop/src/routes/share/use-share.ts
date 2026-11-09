import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { apiUrl, authHeaders } from "@/lib/native";

export interface SharedPayload {
  title: string;
  text: string;
  url: string;
  files: File[];
}

export type ShareMode = "file" | "link" | "text";

const URL_RE = /https?:\/\/[^\s]+/;

/** First URL found in the share — explicit url param, else extracted from text. */
export function sharedUrl(payload: SharedPayload): string | null {
  if (payload.url) return payload.url;
  const match = URL_RE.exec(payload.text);
  return match ? match[0] : null;
}

export function shareMode(payload: SharedPayload): ShareMode {
  if (payload.files.length > 0) return "file";
  if (sharedUrl(payload)) return "link";
  return "text";
}

export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isInstagram(url: string | null): boolean {
  if (!url) return false;
  const site = siteOf(url);
  return site === "instagram.com" || site === "instagr.am";
}

/** Reads the payload the service worker stashed for this share (/share?share=<id>),
 *  or plain GET params (?title=&text=&url=) as a fallback / for testing. */
async function loadPayload(search: URLSearchParams): Promise<SharedPayload> {
  const id = search.get("share");
  if (!id) {
    return { title: search.get("title") ?? "", text: search.get("text") ?? "", url: search.get("url") ?? "", files: [] };
  }
  const res = await fetch(apiUrl(`/share-inbox/${id}`), { credentials: "include", headers: authHeaders() });
  if (!res.ok) throw new Error("The shared payload is gone — try sharing again.");
  const form = await res.formData();
  const str = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : "";
  };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  return { title: str("title"), text: str("text"), url: str("url"), files };
}

export function useSharedPayload(search: URLSearchParams) {
  return useQuery({
    queryKey: ["share", "payload", search.toString()],
    queryFn: () => loadPayload(search),
    staleTime: Infinity,
    retry: false,
  });
}

/* ---------- destinations ---------- */

export interface SharedContentDatabase {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  deletedAt: string | null;
  updatedAt: string;
}

export interface SharedContentSettings {
  databases: SharedContentDatabase[];
  targets: { default: string | null; instagram: string | null };
  statuses: string[];
  instagram: { sessionIdConfigured: boolean; sessionIdMasked: string | null };
}

export function useSharedContentSettings() {
  return useQuery({
    queryKey: ["shared-content"],
    queryFn: () => api<SharedContentSettings>("/api/shared-content"),
  });
}

export interface ChatChannelSummary {
  id: string;
  name: string;
  kind: string;
  unread: number;
  memberCount: number;
  archivedAt: string | null;
}

export function useChatChannels() {
  return useQuery({
    queryKey: ["chat", "channels"],
    queryFn: () => api<ChatChannelSummary[]>("/api/chat/channels"),
  });
}

export interface StorageBucket {
  id: string;
  name: string;
  backendName: string;
  backendType: "object" | "block";
}

export function useStorageBuckets() {
  return useQuery({
    queryKey: ["storage", "buckets"],
    queryFn: () => api<StorageBucket[]>("/api/storage/buckets"),
  });
}

export interface StorageEntry {
  path: string;
  type: "file" | "folder";
}

export function useStorageFolder(bucketId: string | null, path: string) {
  return useQuery({
    queryKey: ["storage", "entries", bucketId, path],
    queryFn: () => api<StorageEntry[]>(`/api/storage/buckets/${bucketId}/list?path=${encodeURIComponent(path)}`),
    enabled: !!bucketId,
  });
}

export interface NoteTreeNode {
  id: string;
  parentId: string | null;
  kind: "section" | "page" | "database";
  title: string;
  icon: string | null;
  isRow: boolean;
  dangling: boolean;
}

export function useNoteTree() {
  return useQuery({
    queryKey: ["notes", "tree"],
    queryFn: () => api<{ nodes: NoteTreeNode[] }>("/api/notes/tree"),
  });
}

interface DatabaseSummaryRow {
  id: string;
  title: string;
  schemaLockedBy: string | null;
  deletedAt: string | null;
  dangling: boolean;
}

export function useNoteDatabases() {
  return useQuery({
    queryKey: ["notes", "databases"],
    queryFn: () => api<{ databases: DatabaseSummaryRow[] }>("/api/notes/databases"),
  });
}

/* ---------- actions ---------- */

/** Upload files into a storage bucket folder. */
export async function saveToFiles(bucketId: string, dir: string, files: File[]) {
  for (const file of files) {
    const rel = `${dir ? `${dir}/` : ""}${file.name}`;
    const res = await fetch(apiUrl(`/api/storage/buckets/${bucketId}/raw/${rel}`), {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": file.type || "application/octet-stream", ...authHeaders() },
      body: await file.arrayBuffer(),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `upload failed (${res.status})`);
    }
  }
}

/** Upload files as chat assets, then post one message with the text + attachments. */
export async function sendToChat(channelId: string, payload: SharedPayload) {
  const attachments: { mediaId: string; filename: string; contentType: string | null }[] = [];
  for (const file of payload.files) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl(`/api/chat/channels/${channelId}/assets`), {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: fd,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `asset upload failed (${res.status})`);
    }
    const asset = (await res.json()) as { id: string; filename: string; contentType: string | null };
    attachments.push({ mediaId: asset.id, filename: asset.filename, contentType: asset.contentType });
  }
  const parts = [payload.text, payload.url].filter(Boolean);
  const body = parts.join("\n") || attachments.map((a) => a.filename).join("\n") || payload.title || "(shared)";
  await api(`/api/chat/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, ...(attachments.length ? { attachments } : {}) }),
  });
}

/** Minimal tiptap doc from plain text (one paragraph per line). */
function tiptapDoc(text: string) {
  return {
    doc: {
      type: "doc",
      content: text
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
    },
  };
}

function markdownBody(payload: SharedPayload): string {
  const url = sharedUrl(payload);
  const parts: string[] = [];
  if (payload.text) parts.push(payload.text);
  if (url && url !== payload.text) parts.push(url);
  if (payload.files.length) parts.push(payload.files.map((f) => `📎 ${f.name}`).join("\n"));
  return parts.join("\n\n");
}

export interface NoteTarget {
  kind: "page" | "database";
  id: string;
  title: string;
  schemaLockedBy: string | null;
}

/** Add the share to notes: a row when the target is a database (shared_content
 *  databases get the full property treatment), otherwise a nested page. */
export async function addToNotes(target: NoteTarget, payload: SharedPayload) {
  const title = payload.title || sharedUrl(payload) || payload.files[0]?.name || "Shared content";
  if (target.kind === "database") {
    if (target.schemaLockedBy === "twodb:shared_content") {
      await api("/api/shared-content/rows", {
        method: "POST",
        body: JSON.stringify({
          databaseId: target.id,
          url: sharedUrl(payload),
          text: payload.text || null,
          title,
          medias: payload.files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
          process: false,
        }),
      });
      return;
    }
    await api(`/api/notes/databases/${target.id}/rows`, {
      method: "POST",
      body: JSON.stringify({ title, content: tiptapDoc(markdownBody(payload)), preview: markdownBody(payload).slice(0, 200) }),
    });
    return;
  }
  const node = await api<{ id: string }>("/api/notes/nodes", {
    method: "POST",
    body: JSON.stringify({ parentId: target.id, kind: "page", title }),
  });
  const body = markdownBody(payload);
  if (body) {
    await api(`/api/notes/nodes/${node.id}`, { method: "PATCH", body: JSON.stringify({ content: tiptapDoc(body), preview: body.slice(0, 200) }) });
  }
}

/** Save a shared link into a shared_content database. */
export async function saveLink(input: { databaseId: string; url: string; text: string; title: string; tags: string[]; process: boolean }) {
  return api<{ noteId: string; databaseId: string; status: string }>("/api/shared-content/rows", { method: "POST", body: JSON.stringify(input) });
}
