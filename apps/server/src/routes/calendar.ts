import { Hono, type Context } from "hono";
import { db } from "../auth";
import { logger } from "../lib/logger";
import { requireOrgSession } from "../lib/session";
import { EmailAccessError, requireAccountRole } from "../lib/email/access";
import { EmailAuthError } from "../lib/email/types";
import { getMicrosoftOAuthPublic } from "../lib/accounts/microsoft-oauth";
import { getGmailOAuthPublic } from "../lib/email/gmail-oauth";
import {
  calendarAccounts,
  createLocalCalendar,
  deleteLocalCalendar,
  ensureDefaultCalendar,
  exportCalendarIcs,
  exportEventIcs,
  feedIcs,
  getSettings,
  HOLIDAY_PRESETS,
  importIcsFile,
  listCalendars,
  listShares,
  removeShare,
  rotateFeed,
  saveSettings,
  setShare,
  syncSubscription,
  updateCalendar,
} from "../lib/calendar/calendars";
import { requireCalendar, requireEvent } from "../lib/calendar/access";
import {
  createEvent,
  deleteEvent,
  duplicateEvent,
  getEventDetail,
  listOccurrences,
  listTrash,
  moveEvent,
  purgeEvents,
  respondToEvent,
  restoreEvent,
  searchEvents,
  updateEvent,
  type EventInput,
} from "../lib/calendar/events";
import { retryChange, resolveConflict } from "../lib/calendar/export";
import { freeBusy, suggestTimes } from "../lib/calendar/freebusy";
import { inviteForMessage, respondToInvite } from "../lib/calendar/imip";
import { approveChanges, discardLocal, listPending, pendingCount, pushNow, rejectChanges, type RecurrenceScope } from "../lib/calendar/pending-push";
import { dismissReminder, snoozeReminder, upcomingReminders } from "../lib/calendar/reminders";
import { syncAccountCalendars } from "../lib/calendar/scheduler";
import { CalendarAccessError } from "../lib/calendar/types";
import { handleGoogleNotification, handleMicrosoftNotification, webhookBase } from "../lib/calendar/webhooks";
import { emailStorageReady } from "../lib/email/storage";

// Calendar REST. Reads come from local tables only; writes land locally and,
// for provider calendars, queue a Pending push row awaiting approval.

async function user(c: Context) {
  const s = await requireOrgSession(c);
  if (!s?.session) return null;
  return { organizationId: s.organizationId, userId: s.session.user.id, role: s.session.user.role };
}

type Handler = (u: NonNullable<Awaited<ReturnType<typeof user>>>, c: Context) => Promise<Response>;

function handle(fn: Handler) {
  return async (c: Context) => {
    const u = await user(c);
    if (!u) return c.json({ error: "unauthorized" }, 401);
    try {
      return await fn(u, c);
    } catch (e) {
      if (e instanceof CalendarAccessError || e instanceof EmailAccessError) return c.json({ error: e.message }, e.status);
      if (e instanceof EmailAuthError) return c.json({ error: "auth_failed", detail: e.message }, 400);
      logger.error({ err: e, path: c.req.path }, "calendar route failed");
      return c.json({ error: "request_failed", detail: (e as Error).message }, 500);
    }
  };
}

async function body(c: Context): Promise<Record<string, unknown>> {
  return ((await c.req.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
}

function scopeOf(c: Context): RecurrenceScope {
  const s = c.req.query("scope");
  return s === "this" || s === "following" ? s : "all";
}

function dateParam(value: string | undefined, fallback: Date): Date {
  const d = value ? new Date(value) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function icsResponse(c: Context, ics: string, filename: string) {
  return c.body(ics, 200, {
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`,
  });
}

export const calendarRoutes = new Hono()
  // ── public: feed + provider webhooks ─────────────────────────────────────
  .get("/feed/:token", async (c) => {
    const ics = await feedIcs((c.req.param("token") ?? "").replace(/\.ics$/, ""));
    if (!ics) return c.text("not found", 404);
    return c.body(ics, 200, { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" });
  })
  .post("/webhooks/google", async (c) => {
    const headers = Object.fromEntries([...c.req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
    const ok = await handleGoogleNotification(headers).catch(() => false);
    return c.body(null, ok ? 200 : 404);
  })
  .post("/webhooks/microsoft", async (c) => {
    const validation = c.req.query("validationToken");
    if (validation) return c.text(validation, 200);
    const payload = (await c.req.json().catch(() => ({}))) as { value?: { subscriptionId?: string; clientState?: string }[] };
    await handleMicrosoftNotification(payload).catch(() => 0);
    return c.body(null, 202);
  })

  // ── meta + settings ──────────────────────────────────────────────────────
  .get(
    "/meta",
    handle(async (u, c) => {
      await ensureDefaultCalendar(u.organizationId, u.userId);
      return c.json({
        google: await getGmailOAuthPublic(),
        microsoft: await getMicrosoftOAuthPublic(),
        webhooksAvailable: !!webhookBase(),
        storageReady: await emailStorageReady(),
        holidayPresets: HOLIDAY_PRESETS,
        isAdmin: u.role === "admin",
        accounts: await calendarAccounts(u.organizationId, u.userId),
      });
    }),
  )
  .get(
    "/settings",
    handle(async (u, c) => c.json(await getSettings(u.organizationId, u.userId))),
  )
  .put(
    "/settings",
    handle(async (u, c) => c.json(await saveSettings(u.organizationId, u.userId, await body(c)))),
  )

  // ── calendars ────────────────────────────────────────────────────────────
  .get(
    "/calendars",
    handle(async (u, c) => {
      await ensureDefaultCalendar(u.organizationId, u.userId);
      return c.json(await listCalendars(u.organizationId, u.userId));
    }),
  )
  .post(
    "/calendars",
    handle(async (u, c) => c.json({ id: await createLocalCalendar(u.organizationId, u.userId, await body(c)) }, 201)),
  )
  .patch(
    "/calendars/:id",
    handle(async (u, c) => {
      await updateCalendar(u.organizationId, u.userId, c.req.param("id") ?? "", await body(c));
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/calendars/:id",
    handle(async (u, c) => {
      await deleteLocalCalendar(u.organizationId, u.userId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/calendars/:id/sync",
    handle(async (u, c) => {
      const { calendar } = await requireCalendar(u.organizationId, u.userId, c.req.param("id") ?? "", "viewer");
      if (calendar.subscriptionUrl) await syncSubscription(calendar.id);
      else if (calendar.accountId) void syncAccountCalendars(calendar.accountId, { force: true });
      return c.json({ ok: true }, 202);
    }),
  )
  .get(
    "/calendars/:id/shares",
    handle(async (u, c) => c.json(await listShares(u.organizationId, u.userId, c.req.param("id") ?? ""))),
  )
  .put(
    "/calendars/:id/shares",
    handle(async (u, c) => {
      await setShare(u.organizationId, u.userId, c.req.param("id") ?? "", await body(c));
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/calendars/:id/shares/:shareId",
    handle(async (u, c) => {
      await removeShare(u.organizationId, u.userId, c.req.param("id") ?? "", c.req.param("shareId") ?? "");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/calendars/:id/feed",
    handle(async (u, c) => {
      const b = await body(c);
      const token = await rotateFeed(u.organizationId, u.userId, c.req.param("id") ?? "", b.enabled !== false);
      const origin = new URL(c.req.url).origin;
      return c.json({ url: token ? `${origin}/api/calendar/feed/${token}.ics` : null });
    }),
  )
  .post(
    "/calendars/:id/import",
    handle(async (u, c) => {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
      if (file.size > 20 * 1024 * 1024) return c.json({ error: "file_too_large" }, 400);
      return c.json({ imported: await importIcsFile(u.organizationId, u.userId, c.req.param("id") ?? "", await file.text()) });
    }),
  )
  .get(
    "/calendars/:id/export.ics",
    handle(async (u, c) => {
      const from = c.req.query("from") ? new Date(c.req.query("from")!) : undefined;
      const to = c.req.query("to") ? new Date(c.req.query("to")!) : undefined;
      const { name, ics } = await exportCalendarIcs(u.organizationId, u.userId, c.req.param("id") ?? "", from, to);
      return icsResponse(c, ics, `${name}.ics`);
    }),
  )

  // ── accounts (calendar side) ─────────────────────────────────────────────
  .post(
    "/accounts/:id/sync",
    handle(async (u, c) => {
      const id = c.req.param("id") ?? "";
      await requireAccountRole(u.organizationId, u.userId, id, "member");
      await db
        .updateTable("connected_account")
        .set({ calendarState: "active", calendarError: null })
        .where("id", "=", id)
        .where("calendarState", "=", "error")
        .execute();
      void syncAccountCalendars(id, { force: true });
      return c.json({ ok: true }, 202);
    }),
  )

  // ── events ───────────────────────────────────────────────────────────────
  .get(
    "/occurrences",
    handle(async (u, c) => {
      const from = dateParam(c.req.query("from"), new Date(Date.now() - 7 * 86_400_000));
      const to = dateParam(c.req.query("to"), new Date(from.getTime() + 42 * 86_400_000));
      if (to.getTime() - from.getTime() > 400 * 86_400_000) return c.json({ error: "range_too_large" }, 400);
      const ids = (c.req.query("calendarIds") ?? "").split(",").filter(Boolean);
      return c.json(await listOccurrences(u.organizationId, u.userId, from, to, ids.length ? ids : undefined));
    }),
  )
  .get(
    "/search",
    handle(async (u, c) => {
      const ids = (c.req.query("calendarIds") ?? "").split(",").filter(Boolean);
      return c.json(
        await searchEvents(u.organizationId, u.userId, c.req.query("q") ?? "", {
          from: c.req.query("from") ? new Date(c.req.query("from")!) : undefined,
          to: c.req.query("to") ? new Date(c.req.query("to")!) : undefined,
          calendarIds: ids.length ? ids : undefined,
        }),
      );
    }),
  )
  .post(
    "/events",
    handle(async (u, c) => c.json({ id: await createEvent(u.organizationId, u.userId, (await body(c)) as EventInput) }, 201)),
  )
  .get(
    "/events/:id",
    handle(async (u, c) => c.json(await getEventDetail(u.organizationId, u.userId, c.req.param("id") ?? ""))),
  )
  .patch(
    "/events/:id",
    handle(async (u, c) =>
      c.json({
        id: await updateEvent(
          u.organizationId,
          u.userId,
          c.req.param("id") ?? "",
          (await body(c)) as EventInput,
          scopeOf(c),
          c.req.query("occurrence") ?? null,
        ),
      }),
    ),
  )
  .delete(
    "/events/:id",
    handle(async (u, c) => {
      await deleteEvent(u.organizationId, u.userId, c.req.param("id") ?? "", scopeOf(c), c.req.query("occurrence") ?? null);
      return c.json({ ok: true });
    }),
  )
  .post(
    "/events/:id/restore",
    handle(async (u, c) => {
      await restoreEvent(u.organizationId, u.userId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/events/:id/rsvp",
    handle(async (u, c) => {
      const b = await body(c);
      await respondToEvent(
        u.organizationId,
        u.userId,
        c.req.param("id") ?? "",
        String(b.status ?? ""),
        typeof b.comment === "string" ? b.comment : null,
        scopeOf(c),
        c.req.query("occurrence") ?? null,
      );
      return c.json({ ok: true });
    }),
  )
  .post(
    "/events/:id/move",
    handle(async (u, c) => {
      const b = await body(c);
      await moveEvent(u.organizationId, u.userId, c.req.param("id") ?? "", String(b.calendarId ?? ""));
      return c.json({ ok: true });
    }),
  )
  .post(
    "/events/:id/duplicate",
    handle(async (u, c) => {
      const b = await body(c);
      return c.json({ id: await duplicateEvent(u.organizationId, u.userId, c.req.param("id") ?? "", (b.calendarId as string) ?? null) }, 201);
    }),
  )
  .post(
    "/events/:id/push-now",
    handle(async (u, c) => {
      await requireEvent(u.organizationId, u.userId, c.req.param("id") ?? "", "editor");
      await pushNow(u.organizationId, u.userId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/events/:id/discard-local",
    handle(async (u, c) => {
      await requireEvent(u.organizationId, u.userId, c.req.param("id") ?? "", "editor");
      await discardLocal(u.organizationId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  )
  .get(
    "/events/:id/export.ics",
    handle(async (u, c) => {
      const { event } = await requireEvent(u.organizationId, u.userId, c.req.param("id") ?? "", "viewer");
      return icsResponse(c, await exportEventIcs(event.id), `${event.title || "event"}.ics`);
    }),
  )

  // ── trash ────────────────────────────────────────────────────────────────
  .get(
    "/trash",
    handle(async (u, c) => c.json(await listTrash(u.organizationId, u.userId))),
  )
  .delete(
    "/trash",
    handle(async (u, c) => {
      const b = await body(c);
      return c.json({ purged: await purgeEvents(u.organizationId, u.userId, Array.isArray(b.ids) ? b.ids.map(String) : "all") });
    }),
  )

  // ── pending push ─────────────────────────────────────────────────────────
  .get(
    "/pending",
    handle(async (u, c) =>
      c.json(
        await listPending(u.organizationId, u.userId, {
          accountId: c.req.query("accountId"),
          calendarId: c.req.query("calendarId"),
          op: c.req.query("op"),
          history: c.req.query("history") === "1",
        }),
      ),
    ),
  )
  .get(
    "/pending/count",
    handle(async (u, c) => c.json(await pendingCount(u.organizationId, u.userId))),
  )
  .post(
    "/pending/approve",
    handle(async (u, c) => {
      const b = await body(c);
      const ids = b.all === true ? null : Array.isArray(b.ids) ? b.ids.map(String) : [];
      const filter = (b.filter as Record<string, string>) ?? {};
      const n = await approveChanges(u.organizationId, u.userId, ids, filter);
      const accounts = await db
        .selectFrom("calendar_change")
        .select("accountId")
        .distinct()
        .where("status", "=", "pending")
        .where("organizationId", "=", u.organizationId)
        .execute();
      for (const a of accounts) void syncAccountCalendars(a.accountId, { force: false });
      return c.json({ approved: n });
    }),
  )
  .post(
    "/pending/reject",
    handle(async (u, c) => {
      const b = await body(c);
      const ids = b.all === true ? null : Array.isArray(b.ids) ? b.ids.map(String) : [];
      return c.json({ rejected: await rejectChanges(u.organizationId, u.userId, ids, (b.filter as Record<string, string>) ?? {}) });
    }),
  )
  .post(
    "/pending/:id/retry",
    handle(async (u, c) => {
      await retryChange(u.organizationId, u.userId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/pending/:id/resolve",
    handle(async (u, c) => {
      const b = await body(c);
      await resolveConflict(u.organizationId, u.userId, c.req.param("id") ?? "", b.resolution === "theirs" ? "theirs" : "mine");
      return c.json({ ok: true });
    }),
  )

  // ── scheduling ───────────────────────────────────────────────────────────
  .post(
    "/freebusy",
    handle(async (u, c) => {
      const b = await body(c);
      return c.json(
        await freeBusy(
          u.organizationId,
          u.userId,
          String(b.calendarId ?? ""),
          Array.isArray(b.attendees) ? b.attendees.map(String) : [],
          new Date(String(b.from)),
          new Date(String(b.to)),
        ),
      );
    }),
  )
  .post(
    "/suggest-times",
    handle(async (u, c) => {
      const b = await body(c);
      return c.json(
        await suggestTimes(
          u.organizationId,
          u.userId,
          String(b.calendarId ?? ""),
          Array.isArray(b.attendees) ? b.attendees.map(String) : [],
          Number(b.durationMin ?? 30),
          new Date(String(b.from)),
          new Date(String(b.to)),
        ),
      );
    }),
  )

  // ── invitations (email reader card) ──────────────────────────────────────
  .get(
    "/invites/:messageId",
    handle(async (u, c) => c.json(await inviteForMessage(u.organizationId, c.req.param("messageId") ?? ""))),
  )
  .post(
    "/invites/:messageId/respond",
    handle(async (u, c) => {
      const b = await body(c);
      const status = b.status === "declined" || b.status === "tentative" ? b.status : "accepted";
      await respondToInvite(u.organizationId, u.userId, c.req.param("messageId") ?? "", status, typeof b.comment === "string" ? b.comment : null);
      return c.json({ ok: true });
    }),
  )

  // ── reminders ────────────────────────────────────────────────────────────
  .get(
    "/reminders",
    handle(async (u, c) => c.json(await upcomingReminders(u.userId))),
  )
  .post(
    "/reminders/:id/snooze",
    handle(async (u, c) => {
      const b = await body(c);
      await snoozeReminder(u.userId, c.req.param("id") ?? "", Number(b.minutes ?? 5));
      return c.json({ ok: true });
    }),
  )
  .post(
    "/reminders/:id/dismiss",
    handle(async (u, c) => {
      await dismissReminder(u.userId, c.req.param("id") ?? "");
      return c.json({ ok: true });
    }),
  );
