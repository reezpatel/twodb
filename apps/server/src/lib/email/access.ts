import { db } from "../../auth";

export type EmailRole = "owner" | "member" | "viewer";

const RANK: Record<EmailRole, number> = { viewer: 0, member: 1, owner: 2 };

export class EmailAccessError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}

/** Accounts the user can see, with their role — every email query is scoped through this. */
export async function accessibleAccounts(organizationId: string, userId: string): Promise<Map<string, EmailRole>> {
  const rows = await db
    .selectFrom("email_account_member")
    .innerJoin("email_account", "email_account.id", "email_account_member.accountId")
    .select(["email_account_member.accountId", "email_account_member.role"])
    .where("email_account_member.userId", "=", userId)
    .where("email_account.organizationId", "=", organizationId)
    .where("email_account.deletedAt", "is", null)
    .execute();
  return new Map(rows.map((r) => [r.accountId, r.role as EmailRole]));
}

export async function accessibleAccountIds(organizationId: string, userId: string): Promise<string[]> {
  return [...(await accessibleAccounts(organizationId, userId)).keys()];
}

/** Throws unless the user holds at least `min` on the account. */
export async function requireAccountRole(organizationId: string, userId: string, accountId: string, min: EmailRole): Promise<EmailRole> {
  const role = (await accessibleAccounts(organizationId, userId)).get(accountId);
  if (!role) throw new EmailAccessError(404, "account_not_found");
  if (RANK[role] < RANK[min]) throw new EmailAccessError(403, "forbidden");
  return role;
}

/** Loads a thread the user can access, enforcing the role on its account. */
export async function requireThread(organizationId: string, userId: string, threadId: string, min: EmailRole = "viewer") {
  const thread = await db.selectFrom("email_thread").selectAll().where("id", "=", threadId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!thread || thread.purgedAt) throw new EmailAccessError(404, "thread_not_found");
  await requireAccountRole(organizationId, userId, thread.accountId, min).catch((e: EmailAccessError) => {
    throw e.status === 404 ? new EmailAccessError(404, "thread_not_found") : e;
  });
  return thread;
}

export async function requireMessage(organizationId: string, userId: string, messageId: string, min: EmailRole = "viewer") {
  const message = await db.selectFrom("email_message").selectAll().where("id", "=", messageId).where("organizationId", "=", organizationId).executeTakeFirst();
  if (!message || message.purgedAt) throw new EmailAccessError(404, "message_not_found");
  await requireAccountRole(organizationId, userId, message.accountId, min).catch((e: EmailAccessError) => {
    throw e.status === 404 ? new EmailAccessError(404, "message_not_found") : e;
  });
  return message;
}

/** Users that should receive realtime events for an account. */
export async function accountMemberIds(accountId: string): Promise<string[]> {
  const rows = await db.selectFrom("email_account_member").select("userId").where("accountId", "=", accountId).execute();
  return rows.map((r) => r.userId);
}
