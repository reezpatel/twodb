import { db } from "../../auth";
import { EmailAccessError, accessibleAccounts, type EmailRole } from "../email/access";

// One contact book per connected account (shared by its mail and calendar)
// plus one local book per user for twodb calendars. Books never mix.

export interface BookRow {
  id: string;
  organizationId: string;
  kind: string;
  accountId: string | null;
  ownerUserId: string;
}

export async function ensureAccountBook(organizationId: string, accountId: string, ownerUserId: string): Promise<string> {
  const now = new Date();
  await db
    .insertInto("contact_book")
    .values({
      id: crypto.randomUUID(),
      organizationId,
      kind: "account",
      accountId,
      ownerUserId,
      learnProgress: "{}",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .onConflict((oc) => oc.column("accountId").where("accountId", "is not", null).doNothing())
    .execute();
  const row = await db.selectFrom("contact_book").select("id").where("accountId", "=", accountId).executeTakeFirstOrThrow();
  return row.id;
}

export async function ensureLocalBook(organizationId: string, userId: string): Promise<string> {
  const existing = await db
    .selectFrom("contact_book")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where("ownerUserId", "=", userId)
    .where("kind", "=", "local")
    .executeTakeFirst();
  if (existing) return existing.id;
  const now = new Date();
  await db
    .insertInto("contact_book")
    .values({
      id: crypto.randomUUID(),
      organizationId,
      kind: "local",
      accountId: null,
      ownerUserId: userId,
      learnState: "done",
      learnProgress: "{}",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .onConflict((oc) => oc.columns(["organizationId", "ownerUserId"]).where("kind", "=", "local").doNothing())
    .execute();
  return (
    await db
      .selectFrom("contact_book")
      .select("id")
      .where("organizationId", "=", organizationId)
      .where("ownerUserId", "=", userId)
      .where("kind", "=", "local")
      .executeTakeFirstOrThrow()
  ).id;
}

export async function setBookDeleted(accountId: string, deleted: boolean) {
  await db
    .updateTable("contact_book")
    .set({ deletedAt: deleted ? new Date() : null, updatedAt: new Date() })
    .where("accountId", "=", accountId)
    .execute();
}

export async function bookIdForAccount(accountId: string): Promise<string | null> {
  const row = await db.selectFrom("contact_book").select("id").where("accountId", "=", accountId).where("deletedAt", "is", null).executeTakeFirst();
  return row?.id ?? null;
}

/**
 * The book a calendar uses: its account's book, or — for twodb calendars —
 * the acting user's local book (a shared twodb calendar never exposes the
 * owner's local contacts to other editors).
 */
export async function bookIdForCalendar(calendar: { accountId: string | null; organizationId: string }, actingUserId: string): Promise<string> {
  if (calendar.accountId) {
    const id = await bookIdForAccount(calendar.accountId);
    if (id) return id;
    const account = await db.selectFrom("connected_account").select(["ownerUserId"]).where("id", "=", calendar.accountId).executeTakeFirstOrThrow();
    return ensureAccountBook(calendar.organizationId, calendar.accountId, account.ownerUserId);
  }
  return ensureLocalBook(calendar.organizationId, actingUserId);
}

export interface BookAccess {
  book: BookRow;
  role: EmailRole;
}

/** Account books follow the account's member role; the local book belongs to its user only. */
export async function requireBook(organizationId: string, userId: string, bookId: string, min: EmailRole = "viewer"): Promise<BookAccess> {
  const book = await db
    .selectFrom("contact_book")
    .select(["id", "organizationId", "kind", "accountId", "ownerUserId"])
    .where("id", "=", bookId)
    .where("organizationId", "=", organizationId)
    .where("deletedAt", "is", null)
    .executeTakeFirst();
  if (!book) throw new EmailAccessError(404, "book_not_found");
  let role: EmailRole | undefined;
  if (book.kind === "local") role = book.ownerUserId === userId ? "owner" : undefined;
  else role = (await accessibleAccounts(organizationId, userId)).get(book.accountId ?? "");
  if (!role) throw new EmailAccessError(404, "book_not_found");
  const rank = { viewer: 0, member: 1, owner: 2 };
  if (rank[role] < rank[min]) throw new EmailAccessError(403, "forbidden");
  return { book, role };
}

export async function listBooks(organizationId: string, userId: string) {
  const roles = await accessibleAccounts(organizationId, userId);
  const localId = await ensureLocalBook(organizationId, userId);
  const accountBooks = roles.size
    ? await db
        .selectFrom("contact_book")
        .innerJoin("connected_account", "connected_account.id", "contact_book.accountId")
        .select([
          "contact_book.id",
          "contact_book.accountId",
          "contact_book.learnState",
          "contact_book.learnProgress",
          "connected_account.address",
          "connected_account.displayName",
          "connected_account.suggestOrgMembers",
        ])
        .where("contact_book.accountId", "in", [...roles.keys()])
        .where("contact_book.deletedAt", "is", null)
        .execute()
    : [];
  const counts = await db
    .selectFrom("contact")
    .select(({ fn }) => ["bookId", fn.countAll<string>().as("n")])
    .where("bookId", "in", [localId, ...accountBooks.map((b) => b.id)])
    .where("forgottenAt", "is", null)
    .where("deletedAt", "is", null)
    .where("kind", "=", "person")
    .groupBy("bookId")
    .execute();
  const countOf = (id: string) => Number(counts.find((c) => c.bookId === id)?.n ?? 0);
  return [
    ...accountBooks.map((b) => ({
      id: b.id,
      kind: "account" as const,
      accountId: b.accountId,
      label: b.address,
      displayName: b.displayName,
      role: roles.get(b.accountId ?? "") ?? "viewer",
      suggestOrgMembers: b.suggestOrgMembers,
      learnState: b.learnState,
      learnProgress: b.learnProgress,
      count: countOf(b.id),
    })),
    {
      id: localId,
      kind: "local" as const,
      accountId: null,
      label: "twodb calendars",
      displayName: null,
      role: "owner" as EmailRole,
      suggestOrgMembers: false,
      learnState: "done",
      learnProgress: {},
      count: countOf(localId),
    },
  ];
}
