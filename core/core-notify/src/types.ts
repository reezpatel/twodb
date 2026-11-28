/**
 * @twodb/core-notify — the notification contract shared by the control plane
 * (TwoDB, which owns notification + push-subscription state) and every app
 * that sends or receives notifications.
 *
 * Ownership model: apps never share tables. Notification rows and Web Push
 * subscriptions live in the control plane (same reason identity does — a
 * user's devices/inbox aren't any one app's data). Apps:
 *
 *   1. SEND    via `createNotifier(runtime)` → POST /apps/twodb/api/notify/send.
 *              The response carries the stored notification — the app relays
 *              it onto its own WS hub for online users (the app already has
 *              the workspace context a control-plane delivery job would lack)
 *   2. PUSH    the control plane fans out to Web Push subscriptions, so
 *              installed PWAs get background notifications
 *   3. READ    via the user's session: GET /notify/notifications etc.
 *              (proxied like any control-plane endpoint) — this is also how a
 *              unified cross-app inbox is built (`?app=` filters per app)
 */
import { z } from "zod";

export const notificationKind = z.string().min(1).max(64);

export const notification = z.object({
  id: z.string(),
  app: z.string(),
  kind: notificationKind,
  title: z.string(),
  body: z.string(),
  /** Absolute URL (or app-relative path the control plane resolved) opened on click. */
  deepLink: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notification>;

export const sendNotificationRequest = z.object({
  userId: z.string(),
  kind: notificationKind,
  title: z.string().min(1).max(200),
  body: z.string().max(2000).default(""),
  deepLink: z.string().max(2000).optional(),
  /** App-defined payload relayed verbatim to the app's own subscriber (channel/message ids, …). */
  data: z.record(z.string(), z.unknown()).optional(),
});
export type SendNotificationRequest = z.infer<typeof sendNotificationRequest>;

export const sendNotificationResponse = z.object({
  notification,
  /** How many Web Push subscriptions accepted the delivery (0 when push isn't configured). */
  pushed: z.number(),
});

/** Kept for subscribers that want the live frame shape (the app relays exactly this onto its own WS hub). */
export const notificationFrame = z.object({
  type: z.literal("notification"),
  workspaceId: z.string().nullable(),
  userId: z.string(),
  notification,
});
export type NotificationFrame = z.infer<typeof notificationFrame>;

/** Web Push subscription as the browser's Push API hands it over. */
export const pushSubscriptionKeys = z.object({
  p256dh: z.string(),
  auth: z.string(),
});
export const pushSubscriptionBody = z.object({
  endpoint: z.string().url(),
  keys: pushSubscriptionKeys,
  /** Human-readable label ("Chrome on Mac") the UI can show in a devices list. */
  deviceLabel: z.string().max(200).optional(),
});
export type PushSubscriptionBody = z.infer<typeof pushSubscriptionBody>;

/** Job type the control plane enqueues internally to retry failed web-push sends. */
export const WEB_PUSH_JOB = "twodb.notify.web_push";
export const webPushJobPayload = z.object({
  notificationId: z.string(),
  endpoint: z.string(),
});
export type WebPushJobPayload = z.infer<typeof webPushJobPayload>;

