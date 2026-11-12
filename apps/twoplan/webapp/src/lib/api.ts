// Thin client over TwoPlan's API — always through the gateway (dev proxy /twoplan-api -> /apps/twoplan).
const BASE = "/twoplan-api";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  let json: any = text;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const msg = json?.message ?? json?.issues?.map((i: any) => `${i.path}: ${i.message}`).join(", ") ?? res.statusText;
    throw new ApiError(res.status, json?.error ?? "error", msg);
  }
  return json;
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse(res);
}

export const get = <T = any>(p: string) => api<T>("GET", p);
export const post = <T = any>(p: string, b: unknown = {}) => api<T>("POST", p, b);
export const patch = <T = any>(p: string, b: unknown) => api<T>("PATCH", p, b);
export const put = <T = any>(p: string, b: unknown) => api<T>("PUT", p, b);
export const del = <T = any>(p: string) => api<T>("DELETE", p);

export function qs(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export async function uploadAttachment(ticketId: string, file: File) {
  const res = await fetch(`${BASE}/tickets/${ticketId}/attachments${qs({ fileName: file.name })}`, {
    method: "POST", credentials: "include", headers: { "content-type": file.type || "application/octet-stream" }, body: file,
  });
  return parse(res);
}

export const attachmentUrl = (ticketId: string, id: string) => `${BASE}/tickets/${ticketId}/attachments/${id}`;
export const exportUrl = (projectKey: string, format: "csv" | "json") => `${BASE}/projects/${projectKey}/export?format=${format}`;
