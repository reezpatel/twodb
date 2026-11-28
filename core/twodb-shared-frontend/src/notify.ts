/**
 * Client for the control-plane notification service (owned by TwoDB). Every
 * app webapp uses this for its inbox: notifications live on the control
 * plane so a unified cross-app inbox is just a query away (`app` omitted).
 *
 * Auth: the user's own session token (same one the gateway accepts). The
 * `app` argument scopes the inbox to one app — pass your own slug.
 */
import { resolveConfig, currentToken } from "./client.js";

export interface AppNotification {
  id: string;
  app: string;
  kind: string;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}

function base(): string {
  return `${resolveConfig().gatewayBase}/apps/twodb/api/notify`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = currentToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${base()}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.json() as Promise<T>;
}

export const notifyApi = {
  /** The caller's inbox, newest first. `app` filters to one app; omit for the unified inbox. */
  list: (app?: string, limit = 50) =>
    call<{ notifications: AppNotification[]; unread: number }>(
      `/notifications?${new URLSearchParams({ ...(app ? { app } : {}), limit: String(limit) })}`,
    ),

  markRead: (id: string) => call<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST", body: "{}" }),

  markAllRead: () => call<{ ok: boolean }>(`/read-all`, { method: "POST", body: "{}" }),
};

