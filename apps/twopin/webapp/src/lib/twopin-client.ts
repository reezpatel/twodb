// Thin client over TwoPin's API, served behind the Gateway at
// /apps/twopin (Vite proxies in dev). Session cookies carry auth.

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).error ?? detail;
    } catch {
      /* keep raw text */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface BoardDto {
  id: string;
  spaceId: string | null;
  name: string;
  description: string | null;
  pinCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface PinDto {
  id: string;
  boardId: string;
  url: string | null;
  finalUrl: string | null;
  title: string | null;
  description: string | null;
  note: string | null;
  siteName: string | null;
  status: "pending" | "ok" | "error";
  fetchError: string | null;
  fetchedAt: string | null;
  hasImage: boolean;
  hasFavicon: boolean;
  hasMedia: boolean;
  mediaContentType: string | null;
  heroKind: "image" | "video" | null;
  heroContentType: string | null;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface BookmarkFolderDto {
  id: string;
  name: string;
  parentId: string | null;
  bookmarkCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface BookmarkDto {
  id: string;
  folderId: string | null;
  url: string;
  title: string | null;
  description: string | null;
  hasFavicon: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface MetadataPreview {
  ok: true;
  finalUrl: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageDataUri: string | null;
  faviconDataUri: string | null;
}

export const pinImageUrl = (pin: PinDto) => `${BASE}/pins/${pin.id}/image`;
export const pinFaviconUrl = (pin: PinDto) => `${BASE}/pins/${pin.id}/favicon`;
export const pinMediaUrl = (pin: PinDto) => `${BASE}/pins/${pin.id}/media`;
export const bookmarkFaviconUrl = (bookmark: BookmarkDto) => `${BASE}/bookmarks/${bookmark.id}/favicon`;

/** Reads a File into base64 (data: prefix stripped) for media uploads. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const twopinClient = {
  listBoards: () => fetch(`${BASE}/boards`).then((r) => json<BoardDto[]>(r)),
  createBoard: (input: { name: string; description?: string }) =>
    fetch(`${BASE}/boards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<BoardDto>(r)),
  deleteBoard: (id: string) => fetch(`${BASE}/boards/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  listPins: (boardId?: string, tag?: string) => {
    const params = new URLSearchParams();
    if (boardId) params.set("boardId", boardId);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    return fetch(`${BASE}/pins${qs ? `?${qs}` : ""}`).then((r) => json<PinDto[]>(r));
  },
  getPin: (id: string) => fetch(`${BASE}/pins/${id}`).then((r) => json<PinDto>(r)),
  listTags: () => fetch(`${BASE}/tags`).then((r) => json<{ tag: string; count: number }[]>(r)),
  createPin: (input: { boardId: string; url?: string | null; note?: string; title?: string; mediaBase64?: string; mediaContentType?: string; tags?: string[] }) =>
    fetch(`${BASE}/pins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<PinDto>(r)),
  updatePin: (id: string, patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null; tags?: string[] }) =>
    fetch(`${BASE}/pins/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<PinDto>(r)),
  refreshPin: (id: string) => fetch(`${BASE}/pins/${id}/refresh`, { method: "POST" }).then((r) => json<PinDto>(r)),
  deletePin: (id: string) => fetch(`${BASE}/pins/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  // --- Bookmark folders ---
  listBookmarkFolders: () => fetch(`${BASE}/bookmark-folders`).then((r) => json<BookmarkFolderDto[]>(r)),
  createBookmarkFolder: (input: { name: string; parentId?: string | null }) =>
    fetch(`${BASE}/bookmark-folders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<BookmarkFolderDto>(r)),
  updateBookmarkFolder: (id: string, patch: { name?: string; parentId?: string | null }) =>
    fetch(`${BASE}/bookmark-folders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<BookmarkFolderDto>(r)),
  deleteBookmarkFolder: (id: string) => fetch(`${BASE}/bookmark-folders/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  // --- Bookmarks ---
  listBookmarks: (folderId?: string | "unfiled") =>
    fetch(`${BASE}/bookmarks${folderId ? `?folderId=${encodeURIComponent(folderId)}` : ""}`).then((r) => json<BookmarkDto[]>(r)),
  createBookmark: (input: { folderId?: string | null; url: string; title?: string; description?: string }) =>
    fetch(`${BASE}/bookmarks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<BookmarkDto>(r)),
  updateBookmark: (id: string, patch: { folderId?: string | null; url?: string; title?: string | null; description?: string | null }) =>
    fetch(`${BASE}/bookmarks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<BookmarkDto>(r)),
  deleteBookmark: (id: string) => fetch(`${BASE}/bookmarks/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  // --- Settings + share target ---
  getSettings: () => fetch(`${BASE}/settings`).then((r) => json<{ defaultBoardId: string | null }>(r)),
  updateSettings: (defaultBoardId: string | null) =>
    fetch(`${BASE}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultBoardId }),
    }).then((r) => json<{ defaultBoardId: string | null }>(r)),
  shareSave: ({ url }: { url: string }) =>
    fetch(`${BASE}/share-save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).then((r) => json<PinDto>(r)),

  previewMetadata: (url: string) =>
    fetch(`${BASE}/metadata/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).then(async (r) => {
      if (r.status === 422) {
        const body = (await r.json()) as { ok: false; error: string };
        throw new Error(body.error);
      }
      return json<MetadataPreview>(r);
    }),
};
