// Thin client over TwoDrive's API, served behind the Gateway at
// /apps/twodrive (Vite proxies in dev). Session cookies carry auth.

const BASE = "/apps/twodrive";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface BackendDto {
  id: string;
  name: string;
  type: "s3" | "local";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageUsage {
  used: number;
  files: number;
  folders: number;
}

export interface VirtualStorageDto {
  id: string;
  backendId: string;
  name: string;
  prefix: string;
  isDefault: boolean;
  usage: StorageUsage;
  createdAt: string;
  updatedAt: string;
}

export interface EntryDto {
  id: string;
  path: string;
  name: string;
  type: "file" | "folder";
  size: number;
  mimeType: string | null;
  previewType: "image" | "video" | "audio" | "pdf" | "text" | "archive" | "other" | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppOverrideDto {
  id: string;
  appId: string;
  virtualStorageId: string;
  createdAt: string;
}

export interface AccessKeyDto {
  id: string;
  accessKeyId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ShareDto {
  id: string;
  token: string;
  path: string;
  expiresAt: string | null;
  createdAt: string;
}

export const driveClient = {
  // --- backends + storages (sidebar tree) ---
  listTree: () => fetch(`${BASE}/backends`, { credentials: "include" }).then((r) => json<{ backends: BackendDto[]; storages: VirtualStorageDto[] }>(r)),

  createBackend: (payload: { name: string; type: "s3" | "local"; config: Record<string, unknown>; test?: boolean }) =>
    fetch(`${BASE}/backends`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then((r) => json<BackendDto>(r)),

  updateBackend: (id: string, patch: Record<string, unknown>) =>
    fetch(`${BASE}/backends/${id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).then((r) => json<BackendDto>(r)),

  deleteBackend: (id: string) =>
    fetch(`${BASE}/backends/${id}`, { method: "DELETE", credentials: "include" }).then((r) => json<{ ok: boolean }>(r)),

  testBackend: (id: string) =>
    fetch(`${BASE}/backends/${id}/test`, { method: "POST", credentials: "include" }).then((r) => json<{ ok: boolean; error?: string }>(r)),

  createStorage: (payload: { name: string; backendId: string; prefix?: string; setAsDefault?: boolean }) =>
    fetch(`${BASE}/storages`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).then((r) => json<VirtualStorageDto>(r)),

  updateStorage: (id: string, patch: { name?: string; setAsDefault?: boolean }) =>
    fetch(`${BASE}/storages/${id}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).then((r) => json<VirtualStorageDto>(r)),

  deleteStorage: (id: string, opts: { confirm: boolean; hardDelete?: boolean }) =>
    fetch(`${BASE}/storages/${id}?confirm=${opts.confirm ? "true" : "false"}${opts.hardDelete ? "&hardDelete=true" : ""}`, { method: "DELETE", credentials: "include" }).then((r) => json<{ ok: boolean }>(r)),

  getDefaultStorage: () =>
    fetch(`${BASE}/storages/default`, { credentials: "include" }).then((r) => json<{ virtualStorageId: string | null }>(r)),

  setDefaultStorage: (virtualStorageId: string | null) =>
    fetch(`${BASE}/storages/default`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ virtualStorageId }) }).then((r) => json<{ virtualStorageId: string | null }>(r)),

  // --- explorer ---
  listEntries: (storageId: string, path: string, trash = false) =>
    fetch(`${BASE}/storages/${storageId}/entries?path=${encodeURIComponent(path)}${trash ? "&trash=true" : ""}`, { credentials: "include" }).then((r) => json<{ entries: EntryDto[] }>(r)),

  createFolder: (storageId: string, path: string) =>
    fetch(`${BASE}/storages/${storageId}/folders`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) }).then((r) => json<EntryDto>(r)),

  uploadFile: (storageId: string, path: string, data: Blob, contentType?: string) => {
    const body = data;
    return fetch(`${BASE}/storages/${storageId}/files?path=${encodeURIComponent(path)}`, {
      method: "POST",
      credentials: "include",
      headers: contentType ? { "content-type": contentType } : undefined,
      body,
    }).then((r) => json<EntryDto>(r));
  },

  fileUrl: (storageId: string, path: string, download = false) =>
    `${BASE}/storages/${storageId}/files/${path.split("/").map(encodeURIComponent).join("/")}${download ? "?download=1" : ""}`,

  renameEntry: (storageId: string, path: string, newName: string) =>
    fetch(`${BASE}/storages/${storageId}/entries/rename`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, newName }) }).then((r) => json<EntryDto | { ok: boolean }>(r)),

  moveEntry: (storageId: string, from: string, to: string) =>
    fetch(`${BASE}/storages/${storageId}/entries/move`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, to }) }).then((r) => json<{ ok: boolean }>(r)),

  copyEntry: (storageId: string, from: string, to: string) =>
    fetch(`${BASE}/storages/${storageId}/entries/copy`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, to }) }).then((r) => json<{ ok: boolean }>(r)),

  trashEntries: (storageId: string, paths: string[]) =>
    fetch(`${BASE}/storages/${storageId}/entries/trash`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths }) }).then((r) => json<{ ok: boolean }>(r)),

  restoreEntries: (storageId: string, entryIds: string[]) =>
    fetch(`${BASE}/storages/${storageId}/entries/restore`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ entryIds }) }).then((r) => json<{ ok: boolean }>(r)),

  purgeEntries: (storageId: string, paths: string[]) =>
    fetch(`${BASE}/storages/${storageId}/entries/purge`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ paths }) }).then((r) => json<{ ok: boolean; deleted: number }>(r)),

  emptyTrash: (storageId: string) =>
    fetch(`${BASE}/storages/${storageId}/trash/empty`, { method: "POST", credentials: "include" }).then((r) => json<{ ok: boolean; deleted: number }>(r)),

  searchFiles: (storageId: string, query: string) =>
    fetch(`${BASE}/storages/${storageId}/search?query=${encodeURIComponent(query)}`, { credentials: "include" }).then((r) => json<{ entries: EntryDto[] }>(r)),

  recentFiles: (storageId: string) =>
    fetch(`${BASE}/storages/${storageId}/recent`, { credentials: "include" }).then((r) => json<{ entries: EntryDto[] }>(r)),

  // --- shares ---
  createShare: (storageId: string, path: string) =>
    fetch(`${BASE}/storages/${storageId}/shares`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) }).then((r) => json<{ token: string; url: string; expiresAt: string | null }>(r)),

  listShares: (storageId: string) =>
    fetch(`${BASE}/storages/${storageId}/shares`, { credentials: "include" }).then((r) => json<{ shares: ShareDto[] }>(r)),

  revokeShare: (storageId: string, token: string) =>
    fetch(`${BASE}/storages/${storageId}/shares/${token}`, { method: "DELETE", credentials: "include" }).then((r) => json<{ ok: boolean }>(r)),

  // --- app overrides + access keys ---
  listAppOverrides: () =>
    fetch(`${BASE}/app-overrides`, { credentials: "include" }).then((r) => json<{ overrides: AppOverrideDto[] }>(r)),

  setAppOverride: (appId: string, virtualStorageId: string | null) =>
    fetch(`${BASE}/app-overrides/${encodeURIComponent(appId)}`, { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ virtualStorageId }) }).then((r) => json<{ ok: boolean }>(r)),

  listAccessKeys: (storageId: string) =>
    fetch(`${BASE}/storages/${storageId}/keys`, { credentials: "include" }).then((r) => json<{ keys: AccessKeyDto[] }>(r)),

  createAccessKey: (storageId: string, label?: string) =>
    fetch(`${BASE}/storages/${storageId}/keys`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) }).then((r) => json<{ id: string; accessKeyId: string; secretAccessKey: string; label: string }>(r)),

  deleteAccessKey: (storageId: string, id: string) =>
    fetch(`${BASE}/storages/${storageId}/keys/${id}`, { method: "DELETE", credentials: "include" }).then((r) => json<{ ok: boolean }>(r)),
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
