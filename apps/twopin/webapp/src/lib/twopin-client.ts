// Thin client over TwoPin's API, served behind the Gateway at
// /apps/twopin (Vite proxies in dev). Session cookies carry auth.

const BASE = "/apps/twopin";

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
  url: string;
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

export const twopinClient = {
  listBoards: () => fetch(`${BASE}/boards`).then((r) => json<BoardDto[]>(r)),
  createBoard: (input: { name: string; description?: string }) =>
    fetch(`${BASE}/boards`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<BoardDto>(r)),
  deleteBoard: (id: string) => fetch(`${BASE}/boards/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  listPins: (boardId?: string) =>
    fetch(`${BASE}/pins${boardId ? `?boardId=${encodeURIComponent(boardId)}` : ""}`).then((r) => json<PinDto[]>(r)),
  createPin: (input: { boardId: string; url: string; note?: string }) =>
    fetch(`${BASE}/pins`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<PinDto>(r)),
  updatePin: (id: string, patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null }) =>
    fetch(`${BASE}/pins/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<PinDto>(r)),
  refreshPin: (id: string) => fetch(`${BASE}/pins/${id}/refresh`, { method: "POST" }).then((r) => json<PinDto>(r)),
  deletePin: (id: string) => fetch(`${BASE}/pins/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

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
