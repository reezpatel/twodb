import { db } from "../../auth";
import { accessibleAccounts } from "../email/access";
import { CalendarAccessError, type CalendarRow, type EventRow } from "./types";

// Provider calendars inherit the account member role (owner/member write,
// viewer read) capped by the provider's accessRole; twodb calendars use the
// owner plus calendar_share rows (user or whole org).

export type CalendarRole = "owner" | "editor" | "viewer" | "free_busy";

const RANK: Record<CalendarRole, number> = { free_busy: 0, viewer: 1, editor: 2, owner: 3 };

export interface CalendarAccess {
  calendar: CalendarRow;
  role: CalendarRole;
  /** Can approve/reject Pending push for this calendar's account. */
  canApprove: boolean;
}

function providerRole(accountRole: string, accessRole: string): CalendarRole {
  const cap: CalendarRole = accessRole === "owner" ? "owner" : accessRole === "writer" ? "editor" : accessRole === "reader" ? "viewer" : "free_busy";
  const fromAccount: CalendarRole = accountRole === "owner" ? "owner" : accountRole === "member" ? "editor" : "viewer";
  return RANK[cap] < RANK[fromAccount] ? cap : fromAccount;
}

export async function accessibleCalendars(organizationId: string, userId: string): Promise<CalendarAccess[]> {
  const accounts = await accessibleAccounts(organizationId, userId);
  const providerRows = accounts.size
    ? await db
        .selectFrom("calendar")
        .selectAll()
        .where("accountId", "in", [...accounts.keys()])
        .where("deletedAt", "is", null)
        .execute()
    : [];
  const shares = await db
    .selectFrom("calendar_share")
    .select(["calendarId", "role"])
    .where("organizationId", "=", organizationId)
    .where((eb) =>
      eb.or([
        eb.and([eb("principalType", "=", "user"), eb("principal", "=", userId)]),
        eb.and([eb("principalType", "=", "org"), eb("principal", "=", organizationId)]),
      ]),
    )
    .execute();
  const shareRole = new Map<string, CalendarRole>();
  for (const s of shares) {
    const role = s.role as CalendarRole;
    const prev = shareRole.get(s.calendarId);
    if (!prev || RANK[role] > RANK[prev]) shareRole.set(s.calendarId, role);
  }
  const localRows = await db
    .selectFrom("calendar")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("accountId", "is", null)
    .where("deletedAt", "is", null)
    .where((eb) => eb.or([eb("ownerUserId", "=", userId), ...(shareRole.size ? [eb("id", "in", [...shareRole.keys()])] : [])]))
    .execute();

  return [
    ...providerRows.map((calendar) => {
      const accountRole = accounts.get(calendar.accountId!) ?? "viewer";
      return { calendar, role: providerRole(accountRole, calendar.accessRole), canApprove: accountRole !== "viewer" };
    }),
    ...localRows.map((calendar) => ({
      calendar,
      role: calendar.ownerUserId === userId ? ("owner" as const) : (shareRole.get(calendar.id) ?? "viewer"),
      canApprove: false,
    })),
  ];
}

export async function requireCalendar(organizationId: string, userId: string, calendarId: string, min: CalendarRole = "viewer"): Promise<CalendarAccess> {
  const access = (await accessibleCalendars(organizationId, userId)).find((a) => a.calendar.id === calendarId);
  if (!access) throw new CalendarAccessError(404, "calendar_not_found");
  if (RANK[access.role] < RANK[min]) throw new CalendarAccessError(403, access.calendar.kind === "subscription" ? "calendar_read_only" : "forbidden");
  if (min !== "viewer" && min !== "free_busy" && access.calendar.kind === "subscription") throw new CalendarAccessError(403, "calendar_read_only");
  return access;
}

export async function requireEvent(
  organizationId: string,
  userId: string,
  eventId: string,
  min: CalendarRole = "viewer",
): Promise<CalendarAccess & { event: EventRow }> {
  const event = await db.selectFrom("calendar_event").selectAll().where("id", "=", eventId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!event) throw new CalendarAccessError(404, "event_not_found");
  const access = await requireCalendar(organizationId, userId, event.calendarId, min).catch((e: CalendarAccessError) => {
    throw e.status === 404 ? new CalendarAccessError(404, "event_not_found") : e;
  });
  return { ...access, event };
}

export function roleAtLeast(role: CalendarRole, min: CalendarRole) {
  return RANK[role] >= RANK[min];
}
