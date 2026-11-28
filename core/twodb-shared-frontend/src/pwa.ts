/**
 * PWA helpers for app webapps: service-worker registration + Web Push
 * subscription against the control plane. Background notifications require an
 * installed (or installable) PWA — this module is the client half; the server
 * half is the control plane's /notify/push-subscriptions endpoint.
 */
import { useEffect, useRef, useState } from "react";
import { resolveConfig, currentToken } from "./client.js";

export type PushPermission = NotificationPermission | "unsupported";

export interface UsePushSubscriptionOptions {
  /** The app slug this webapp belongs to ("twochat") — subscriptions are per app. */
  app: string;
  /** Path to the service worker. Default "/sw.js". */
  swPath?: string;
  /** Attempt subscription automatically on mount (prompts the user). Default true. */
  auto?: boolean;
}

export interface UsePushSubscription {
  permission: PushPermission;
  /** Whether this device currently has a live push subscription. */
  subscribed: boolean;
  /** True while a subscribe/unsubscribe round-trip is in flight. */
  busy: boolean;
  /** Ask for permission (if needed) and subscribe to push. Safe to call from a click handler. */
  subscribe: () => Promise<boolean>;
  /** Remove this device's subscription. */
  unsubscribe: () => Promise<void>;
}

const VAPID_KEY_URL = () => `${resolveConfig().gatewayBase}/apps/twodb/api/notify/push-key`;
const SUBS_URL = (app: string) => `${resolveConfig().gatewayBase}/apps/twodb/api/notify/push-subscriptions?app=${encodeURIComponent(app)}`;

function authHeaders(): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  const token = currentToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return headers;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const supported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function fetchVapidKey(): Promise<string | null> {
  const res = await fetch(VAPID_KEY_URL(), { headers: authHeaders() });
  if (!res.ok) return null;
  const body = (await res.json()) as { key?: string };
  return body.key ?? null;
}

async function subscribeFlow(swPath: string, app: string): Promise<boolean> {
  if (!supported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const vapidKey = await fetchVapidKey();
  if (!vapidKey) return false; // push not configured on the control plane
  const registration = await navigator.serviceWorker.register(swPath);
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const res = await fetch(SUBS_URL(app), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      deviceLabel: navigator.userAgent.slice(0, 200),
    }),
  });
  return res.ok;
}

async function unsubscribeFlow(swPath: string, app: string): Promise<void> {
  if (!supported()) return;
  const registration = await navigator.serviceWorker.getRegistration(swPath);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetch(SUBS_URL(app), {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

export function usePushSubscription(options: UsePushSubscriptionOptions): UsePushSubscription {
  const { app, swPath = "/sw.js", auto = true } = options;
  const [permission, setPermission] = useState<PushPermission>(() => (supported() ? Notification.permission : "unsupported"));
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!supported()) return;
    let cancelled = false;
    (async () => {
      const registration = await navigator.serviceWorker.getRegistration(swPath).catch(() => undefined);
      const sub = await registration?.pushManager.getSubscription().catch(() => null);
      if (!cancelled) setSubscribed(Boolean(sub));
      if (!cancelled && auto && !sub && !started.current) {
        started.current = true;
        setBusy(true);
        const ok = await subscribeFlow(swPath, app).catch(() => false);
        if (!cancelled) {
          setSubscribed(ok);
          setPermission(Notification.permission);
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, swPath, auto]);

  return {
    permission,
    subscribed,
    busy,
    subscribe: async () => {
      setBusy(true);
      const ok = await subscribeFlow(swPath, app).catch(() => false);
      setSubscribed(ok);
      setPermission(supported() ? Notification.permission : "unsupported");
      setBusy(false);
      return ok;
    },
    unsubscribe: async () => {
      setBusy(true);
      await unsubscribeFlow(swPath, app);
      setSubscribed(false);
      setBusy(false);
    },
  };
}

