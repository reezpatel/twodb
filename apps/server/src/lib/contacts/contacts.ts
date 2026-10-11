import { sql } from "kysely";
import { db } from "../../auth";
import { EmailAccessError } from "../email/access";
import { bookIdForAccount, bookIdForCalendar, requireBook } from "./books";
import { learnContacts, normalizeEmail } from "./learn";

// Contact queries are always tied to exactly one book — the server resolves
// the book from an account or calendar and checks access before reading.

export interface ContactPayload {
  id: string;
  bookId: string;
  email: string;
  name: string | null;
  kind: string;
  domain: string;
  notes: string | null;
  pinned: boolean;
  hidden: boolean;
  sentCount: number;
  receivedCount: number;
  meetingCount: number;
  lastEmailAt: string | null;
  lastMeetingAt: string | null;
  nextMeetingAt: string | null;
  lastSeenAt: string;
  /** Suggested from the org-members toggle; not stored in the book yet. */
  orgMember?: boolean;
}

type ContactRow = {
  id: string;
  bookId: string;
  email: string;
  name: string | null;
  kind: string;
  domain: string;
  notes: string | null;
  pinned: boolean;
  hidden: boolean;
  sentCount: number;
  receivedCount: number;
  meetingCount: number;
  lastEmailAt: Date | null;
  lastMeetingAt: Date | null;
  nextMeetingAt: Date | null;
  lastSeenAt: Date;
};

const COLUMNS = [
  "id",
  "bookId",
  "email",
  "name",
  "kind",
  "domain",
  "notes",
  "pinned",
  "hidden",
  "sentCount",
  "receivedCount",
  "meetingCount",
  "lastEmailAt",
  "lastMeetingAt",
  "nextMeetingAt",
  "lastSeenAt",
] as const;

function serialize(r: ContactRow): ContactPayload {
  return {
    ...r,
    lastEmailAt: r.lastEmailAt?.toISOString() ?? null,
    lastMeetingAt: r.lastMeetingAt?.toISOString() ?? null,
    nextMeetingAt: r.nextMeetingAt && r.nextMeetingAt > new Date() ? r.nextMeetingAt.toISOString() : null,
    lastSeenAt: r.lastSeenAt.toISOString(),
  };
}

export interface BookScope {
  bookId?: string | null;
  accountId?: string | null;
  calendarId?: string | null;
}

/** Resolves {bookId | accountId | calendarId} to one accessible book. */
export async function resolveBook(organizationId: string, userId: string, scope: BookScope) {
  if (scope.bookId) return requireBook(organizationId, userId, scope.bookId);
  if (scope.accountId) {
    const id = await bookIdForAccount(scope.accountId);
    if (!id) throw new EmailAccessError(404, "book_not_found");
    return requireBook(organizationId, userId, id);
  }
  if (scope.calendarId) {
    const calendar = await db
      .selectFrom("calendar")
      .select(["accountId", "organizationId"])
      .where("id", "=", scope.calendarId)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!calendar) throw new EmailAccessError(404, "calendar_not_found");
    return requireBook(organizationId, userId, await bookIdForCalendar(calendar, userId));
  }
  throw new EmailAccessError(400, "book_scope_required");
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Ranked autocomplete inside one book (+ org members when the account opts in). */
export async function suggestContacts(
  organizationId: string,
  userId: string,
  scope: BookScope,
  q: string,
  exclude: string[] = [],
  limit = 8,
): Promise<ContactPayload[]> {
  const { book } = await resolveBook(organizationId, userId, scope);
  const term = q.trim().toLowerCase();
  const excluded = exclude.map((e) => e.toLowerCase());
  let query = db
    .selectFrom("contact")
    .select(COLUMNS)
    .where("bookId", "=", book.id)
    .where("hidden", "=", false)
    .where("forgottenAt", "is", null)
    .where("deletedAt", "is", null)
    .where("kind", "=", "person");
  if (excluded.length) query = query.where("email", "not in", excluded);
  if (term) {
    const like = `${escapeLike(term.replace(/^@/, ""))}%`;
    query = term.startsWith("@")
      ? query.where("domain", "like", like)
      : query.where((eb) =>
          eb.or([eb("email", "like", like), eb(sql`lower(name)`, "like", like), eb(sql`lower(name)`, "like", `% ${like}`), eb("domain", "like", like)]),
        );
  }
  const rows = await query.orderBy("pinned", "desc").orderBy("score", "desc").limit(limit).execute();
  const out = rows.map(serialize);

  if (book.accountId && out.length < limit) {
    const account = await db.selectFrom("connected_account").select("suggestOrgMembers").where("id", "=", book.accountId).executeTakeFirst();
    if (account?.suggestOrgMembers) {
      const have = new Set([...out.map((c) => c.email), ...excluded]);
      let members = db
        .selectFrom("member")
        .innerJoin("user", "user.id", "member.userId")
        .select(["user.id", "user.email", "user.name"])
        .where("member.organizationId", "=", organizationId)
        .where("user.id", "!=", userId);
      if (term) {
        const like = `${escapeLike(term.replace(/^@/, ""))}%`;
        members = members.where((eb) =>
          eb.or([eb(sql`lower("user".email)`, "like", like), eb(sql`lower("user".name)`, "like", like), eb(sql`lower("user".name)`, "like", `% ${like}`)]),
        );
      }
      for (const m of await members.limit(limit).execute()) {
        const email = m.email.toLowerCase();
        if (have.has(email) || out.length >= limit) continue;
        out.push({
          id: `org:${m.id}`,
          bookId: book.id,
          email,
          name: m.name,
          kind: "person",
          domain: email.split("@")[1] ?? "",
          notes: null,
          pinned: false,
          hidden: false,
          sentCount: 0,
          receivedCount: 0,
          meetingCount: 0,
          lastEmailAt: null,
          lastMeetingAt: null,
          nextMeetingAt: null,
          lastSeenAt: new Date(0).toISOString(),
          orgMember: true,
        });
      }
    }
  }
  return out;
}

export interface ListOptions {
  q?: string;
  domain?: string;
  sort?: "rank" | "name" | "recent";
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}

export async function listContacts(organizationId: string, userId: string, scope: BookScope, opts: ListOptions = {}) {
  const { book, role } = await resolveBook(organizationId, userId, scope);
  let query = db
    .selectFrom("contact")
    .where("bookId", "=", book.id)
    .where("forgottenAt", "is", null)
    .where("deletedAt", "is", null)
    .where("kind", "!=", "list");
  if (!opts.includeHidden) query = query.where("hidden", "=", false);
  if (opts.domain) query = query.where("domain", "=", opts.domain.toLowerCase());
  const term = opts.q?.trim().toLowerCase();
  if (term) {
    const like = `%${escapeLike(term)}%`;
    query = query.where((eb) => eb.or([eb("email", "like", like), eb(sql`lower(name)`, "like", like)]));
  }
  const total = Number((await query.select(({ fn }) => fn.countAll<string>().as("n")).executeTakeFirst())?.n ?? 0);
  let rows = query.select(COLUMNS);
  if (opts.sort === "name") rows = rows.orderBy(sql`lower(coalesce(name, email))`);
  else if (opts.sort === "recent") rows = rows.orderBy("lastSeenAt", "desc");
  else rows = rows.orderBy("pinned", "desc").orderBy("score", "desc");
  const list = await rows
    .limit(Math.min(opts.limit ?? 200, 500))
    .offset(opts.offset ?? 0)
    .execute();
  const domains = await db
    .selectFrom("contact")
    .select(({ fn }) => ["domain", fn.countAll<string>().as("n")])
    .where("bookId", "=", book.id)
    .where("forgottenAt", "is", null)
    .where("deletedAt", "is", null)
    .where("hidden", "=", false)
    .where("kind", "=", "person")
    .groupBy("domain")
    .orderBy(sql`count(*)`, "desc")
    .limit(30)
    .execute();
  return { bookId: book.id, role, total, contacts: list.map(serialize), domains: domains.map((d) => ({ domain: d.domain, count: Number(d.n) })) };
}

async function requireContact(organizationId: string, userId: string, contactId: string, min: "viewer" | "member") {
  const contact = await db
    .selectFrom("contact")
    .select(["id", "bookId", "email"])
    .where("id", "=", contactId)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!contact) throw new EmailAccessError(404, "contact_not_found");
  const access = await requireBook(organizationId, userId, contact.bookId, min);
  return { contact, ...access };
}

export async function createContact(organizationId: string, userId: string, scope: BookScope, body: { email?: unknown; name?: unknown; notes?: unknown }) {
  const { book, role } = await resolveBook(organizationId, userId, scope);
  if (role === "viewer") throw new EmailAccessError(403, "forbidden");
  const email = normalizeEmail(String(body.email ?? ""));
  if (!email) throw new EmailAccessError(400, "invalid_email");
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  await db.updateTable("contact").set({ forgottenAt: null, deletedAt: null, hidden: false }).where("bookId", "=", book.id).where("email", "=", email).execute();
  await learnContacts({ organizationId, bookId: book.id, people: [{ email, name }], interaction: "manual", at: new Date(), source: "manual", self: new Set() });
  const row = await db.selectFrom("contact").select(COLUMNS).where("bookId", "=", book.id).where("email", "=", email).executeTakeFirstOrThrow();
  if (name || typeof body.notes === "string") {
    await db
      .updateTable("contact")
      .set({ ...(name ? { name, nameSource: "manual" } : {}), ...(typeof body.notes === "string" ? { notes: body.notes || null } : {}), updatedAt: new Date() })
      .where("id", "=", row.id)
      .execute();
  }
  return serialize(await db.selectFrom("contact").select(COLUMNS).where("id", "=", row.id).executeTakeFirstOrThrow());
}

export async function updateContact(organizationId: string, userId: string, contactId: string, body: Record<string, unknown>) {
  const { contact } = await requireContact(organizationId, userId, contactId, "member");
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") {
    patch.name = body.name.trim() || null;
    patch.nameSource = "manual";
  }
  if (typeof body.notes === "string") patch.notes = body.notes || null;
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.hidden === "boolean") patch.hidden = body.hidden;
  await db.updateTable("contact").set(patch).where("id", "=", contact.id).execute();
  return serialize(await db.selectFrom("contact").select(COLUMNS).where("id", "=", contact.id).executeTakeFirstOrThrow());
}

/** Forget = wipe personal data and keep a tombstone so learning never brings the contact back. */
export async function forgetContact(organizationId: string, userId: string, contactId: string) {
  const { contact } = await requireContact(organizationId, userId, contactId, "member");
  await db
    .updateTable("contact")
    .set({ forgottenAt: new Date(), name: null, notes: null, pinned: false, hidden: true, score: 0, updatedAt: new Date() })
    .where("id", "=", contact.id)
    .execute();
}

/** Recent mail + meetings with this person, only from the book's own account (or twodb calendars for the local book). */
export async function contactActivity(organizationId: string, userId: string, contactId: string) {
  const { contact, book } = await requireContact(organizationId, userId, contactId, "viewer");
  const email = contact.email;
  const emails = book.accountId
    ? await db
        .selectFrom("email_message")
        .select(["id", "threadId", "subject", "snippet", "direction", "sentAt"])
        .where("accountId", "=", book.accountId)
        .where("purgedAt", "is", null)
        .where("status", "in", ["sent", "received"])
        .where((eb) =>
          eb.or([
            eb("fromAddress", "=", email),
            eb(sql`"to" @> ${JSON.stringify([{ address: email }])}::jsonb`, "=", true),
            eb(sql`cc @> ${JSON.stringify([{ address: email }])}::jsonb`, "=", true),
          ]),
        )
        .orderBy("sentAt", "desc")
        .limit(15)
        .execute()
    : [];
  let meetings = db
    .selectFrom("calendar_event_attendee")
    .innerJoin("calendar_event", "calendar_event.id", "calendar_event_attendee.eventId")
    .innerJoin("calendar", "calendar.id", "calendar_event.calendarId")
    .select([
      "calendar_event.id",
      "calendar_event.title",
      "calendar_event.startAt",
      "calendar_event.startDate",
      "calendar_event.isAllDay",
      "calendar_event.calendarId",
    ])
    .where("calendar_event_attendee.email", "=", email)
    .where("calendar_event.deletedAt", "is", null)
    .where("calendar.deletedAt", "is", null);
  meetings = book.accountId
    ? meetings.where("calendar.accountId", "=", book.accountId)
    : meetings.where("calendar.accountId", "is", null).where("calendar.ownerUserId", "=", userId);
  const meetingRows = await meetings.orderBy("calendar_event.startAt", "desc").limit(15).execute();
  return {
    emails: emails.map((e) => ({ ...e, sentAt: e.sentAt?.toISOString() ?? null })),
    meetings: meetingRows.map((m) => ({ ...m, startAt: m.startAt?.toISOString() ?? null })),
  };
}
