/**
 * App-side client for the control-plane notification service. Built on the
 * app's `TwoDbRuntime` — every call is gateway-authenticated with the app
 * token, so the control plane knows exactly which app is sending. Online
 * delivery to the app's own UI is the app's job: relay the returned
 * notification onto your own WS hub.
 */
import { sendNotificationResponse, type Notification, type SendNotificationRequest } from "./types.js";

/** The slice of TwoDbRuntime the notifier needs (kept structural so tests can stub it). */
export interface NotifyRuntime {
  gatewayFetch(path: string, init?: RequestInit): Promise<Response>;
}

export interface Notifier {
  /**
   * Create a notification for one user: control-plane inbox row + durable
   * delivery job back to this app + Web Push fan-out. Returns the stored
   * notification. `deepLink` may be app-relative ("/chat/ch_1") — the
   * control plane resolves it against the app's public URL.
   */
  send(input: Omit<SendNotificationRequest, "body"> & { body?: string }): Promise<{ notification: Notification; pushed: number }>;
}

export function createNotifier(runtime: NotifyRuntime): Notifier {
  return {
    async send(input) {
      const res = await runtime.gatewayFetch("/apps/twodb/api/notify/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`notify.send failed: ${res.status} ${await res.text()}`);
      const parsed = sendNotificationResponse.parse(await res.json());
      return { notification: parsed.notification as Notification, pushed: parsed.pushed };
    },
  };
}

