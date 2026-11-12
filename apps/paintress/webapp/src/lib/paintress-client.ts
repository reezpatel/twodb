// Thin client over Paintress' API — always through the gateway (dev proxy
// /paintress-api → /apps/paintress), so identity is the shared control-plane
// session resolved by TwoDB and forwarded as x-twodb-* headers.
import type { Board, Item, Op } from "@shared/model";

export const BASE = "/paintress-api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string; error?: string });
    throw new Error(body.message ?? body.error ?? `${res.status}`);
  }
  return res.json() as Promise<T>;
}
const init = (method: string, body?: unknown): RequestInit => ({
  method,
  credentials: "include",
  headers: body === undefined ? undefined : { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export interface Space {
  id: string;
  name: string;
}

export interface IconHit {
  id: string;
  set: string;
  name: string;
}

export const paintressClient = {
  listSpaces: () => fetch("/registry/spaces", { credentials: "include" }).then((r) => json<{ spaces: Space[] }>(r)),
  listBoards: () => fetch(`${BASE}/boards`, init("GET")).then((r) => json<{ boards: Board[] }>(r)),
  createBoard: (b: { name: string; kind: "diagram" | "doc"; spaceId?: string }) => fetch(`${BASE}/boards`, init("POST", b)).then((r) => json<Board>(r)),
  getBoard: (id: string) =>
    fetch(`${BASE}/boards/${id}`, init("GET")).then((r) => json<{ board: Board; items: Item[]; doc: { markdown: string; version: number } | null }>(r)),
  updateBoard: (id: string, patch: { name?: string; description?: string }) => fetch(`${BASE}/boards/${id}`, init("PATCH", patch)).then((r) => json<Board>(r)),
  deleteBoard: (id: string) => fetch(`${BASE}/boards/${id}`, init("DELETE")).then((r) => json<{ ok: true }>(r)),
  searchIcons: (q: string, set?: string) =>
    fetch(`${BASE}/icons/search?q=${encodeURIComponent(q)}${set ? `&set=${set}` : ""}&limit=60`, init("GET")).then((r) => json<{ icons: IconHit[] }>(r)),
  relayout: (boardId: string, direction: "LR" | "TB") =>
    fetch(`${BASE}/boards/${boardId}/layout`, init("POST", { direction, label: "Tidy up" })).then((r) =>
      json<{ seq: number; warnings: string[]; inverse?: Op[] }>(r),
    ),
  catalog: () => fetch(`${BASE}/catalog`, init("GET")).then((r) => json<unknown>(r)),
  async uploadAsset(boardId: string, file: File): Promise<{ id: string; contentType: string; size: number; name: string }> {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/boards/${boardId}/assets`, { method: "POST", credentials: "include", body: fd }).then((r) => json(r));
  },
  /** "logos:aws-lambda" → URL of its SVG. */
  iconUrl(id: string, color?: string): string {
    const [set, name] = id.split(":");
    return `${BASE}/icons/${set}/${name}${color ? `?color=${encodeURIComponent(color)}` : ""}`;
  },
  assetUrl: (assetId: string) => `${BASE}/assets/${assetId}`,
  wsUrl(boardId: string): string {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}${BASE}/boards/${boardId}/ws`;
  },
};
