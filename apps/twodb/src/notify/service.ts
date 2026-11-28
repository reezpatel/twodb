/**
 * Cross-app notification service. TwoDB owns the notification inbox and the
 * Web Push subscriptions because they belong to the USER, not to any app —
 * the same reason identity lives here. Apps send via POST /notify/send
 * (app-token auth), read via the session endpoints, and get background push
 * to installed PWAs for free.
 */
import type { Kysely } from "kysely";
import { ulid } from "ulid";
import {
  sendNotificationRequest,
  pushSubscriptionBody,
  type Notification,
} from "@twodb/core-notify";
import type { ControlPlaneDb, NotificationRow } from "../db/sqlite.js";
import type { TwoDbConfig } from "../config.js";

export interface NotifyDeps {
  /** Resolve an app's public base URL for deep links (https://{slug}.twodb.io or the gateway path mount). */
  appBaseUrl: (slug: string) => string;
}

function rowToNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    app: r.app,
    kind: r.kind,
    title: r.title,
    body: r.body,
    deepLink: r.deep_link,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export function createNotifyService(db: Kysely<ControlPlaneDb>, config: TwoDbConfig, deps: NotifyDeps) {
  // Lazily import web-push so a missing/unconfigured VAPID key never breaks boot.
  let pushPromise: Promise<typeof import("web-push") | null> | null = null;
  const pushLib = () => {
    if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return Promise.resolve(null);
    if (!pushPromise) {
      pushPromise = import("web-push")
        .then((wp) => {
          wp.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
          return wp;
        })
        .catch(() => null);
    }
    return pushPromise;
  };

  /** Resolve an app-relative deep link to an absolute URL the browser can open. */
  const resolveDeepLink = (app: string, link: string | undefined): string | null => {
    if (!link) return null;
    if (/^https?:\/\//.test(link)) return link;
    return deps.appBaseUrl(app) + (link.startsWith("/") ? link : `/${link}`);
  };

  async function send(callerApp: string, rawBody: unknown): Promise<{ notification: Notification; pushed: number }> {
    const input = sendNotificationRequest.parse(rawBody);
    const now = new Date().toISOString();
    const row: NotificationRow = {
      id: `ntf_${ulid()}`,
      user_id: input.userId,
      app: callerApp,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      deep_link: resolveDeepLink(callerApp, input.deepLink),
      read_at: null,
      created_at: now,
    };
    await db.insertInto("notification").values(row).execute();
    const notification = rowToNotification(row);
    const pushed = await fanOutPush(input.userId, notification, input.data);
    return { notification, pushed };
  }

  async function fanOutPush(userId: string, n: Notification, data?: Record<string, unknown>): Promise<number> {
    const wp = await pushLib();
    if (!wp) return 0;
    const subs = await db
      .selectFrom("push_subscription")
      .selectAll()
      .where("user_id", "=", userId)
      .where("app", "=", n.app)
      .execute();
    if (subs.length === 0) return 0;
    const payload = JSON.stringify({
      title: n.title,
      body: n.body,
      deepLink: n.deepLink,
      notificationId: n.id,
      data: data ?? {},
    });
    let ok = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await wp.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 },
          );
          ok++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410 = subscription is gone (user revoked / browser uninstalled) — prune it.
          if (status === 404 || status === 410) {
            await db.deleteFrom("push_subscription").where("id", "=", sub.id).execute();
          }
        }
      }),
    );
    return ok;
  }

  return {
    send,
    fanOutPush,
    pushConfigured: () => Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY),
    vapidPublicKey: () => config.VAPID_PUBLIC_KEY ?? null,
  };
}

export type NotifyService = ReturnType<typeof createNotifyService>;

