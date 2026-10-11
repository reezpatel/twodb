import { db } from "../../auth";
import { broadcastEmailEvent } from "../../routes/email-ws";
import { EmailAccessError, accessibleAccounts, requireAccountRole, type EmailRole } from "./access";
import { connectorFor, IMAP_FIELDS, PRESETS } from "./connectors/registry";
import { gmailProfile } from "./connectors/gmail";
import { seal, unseal } from "./crypto";
import { purgeMessages } from "./threads";
import type { EmailAccountRow } from "./types";

export interface AccountPayload {
  id: string;
  kind: string;
  preset: string | null;
  address: string;
  displayName: string | null;
  aliases: string[];
  config: Record<string, unknown>;
  visibility: string;
  role: EmailRole;
  ownerUserId: string;
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  backfillState: string;
  backfillProgress: Record<string, unknown>;
  syncIntervalSec: number;
  signatureHtml: string | null;
  color: string | null;
  hasCredentials: boolean;
  createdAt: string;
}

export function serializeAccount(a: EmailAccountRow, role: EmailRole): AccountPayload {
  return {
    id: a.id,
    kind: a.kind,
    preset: a.preset,
    address: a.address,
    displayName: a.displayName,
    aliases: a.aliases,
    config: role === "owner" ? a.config : {},
    visibility: a.visibility,
    role,
    ownerUserId: a.ownerUserId,
    status: a.status,
    lastError: a.lastError,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    backfillState: a.backfillState,
    backfillProgress: a.backfillProgress,
    syncIntervalSec: a.syncIntervalSec,
    signatureHtml: a.signatureHtml,
    color: a.color,
    hasCredentials: !!a.credentials,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAccounts(organizationId: string, userId: string): Promise<AccountPayload[]> {
  const roles = await accessibleAccounts(organizationId, userId);
  if (!roles.size) return [];
  const rows = await db.selectFrom("email_account").selectAll().where("id", "in", [...roles.keys()]).orderBy("position").orderBy("createdAt").execute();
  return rows.map((r) => serializeAccount(r, roles.get(r.id) as EmailRole));
}

export async function loadAccount(accountId: string): Promise<EmailAccountRow> {
  const row = await db.selectFrom("email_account").selectAll().where("id", "=", accountId).executeTakeFirst();
  if (!row || row.deletedAt) throw new EmailAccessError(404, "account_not_found");
  return row;
}

export function accountCredentials(account: EmailAccountRow): Record<string, unknown> {
  return unseal<Record<string, unknown>>(account.credentials) ?? {};
}

export async function saveAccountCredentials(accountId: string, credentials: Record<string, unknown>) {
  await db.updateTable("email_account").set({ credentials: seal(credentials), updatedAt: new Date() }).where("id", "=", accountId).execute();
}

export async function setAccountStatus(accountId: string, status: string, lastError: string | null) {
  await db.updateTable("email_account").set({ status, lastError, updatedAt: new Date() }).where("id", "=", accountId).execute();
  await broadcastEmailEvent(accountId, { type: "account.status", accountId, status, lastError });
}

function splitImapInput(input: Record<string, unknown>) {
  const config: Record<string, unknown> = {};
  const credentials: Record<string, unknown> = {};
  for (const field of IMAP_FIELDS) {
    const value = input[field.key];
    if (value === undefined || value === "") continue;
    const coerced = field.type === "number" ? Number(value) : field.type === "boolean" ? value === true || value === "true" : String(value);
    if (field.secret) credentials[field.key] = coerced;
    else config[field.key] = coerced;
  }
  return { config, credentials };
}

async function insertAccount(input: {
  organizationId: string;
  userId: string;
  kind: string;
  preset: string;
  address: string;
  displayName: string | null;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
}) {
  const duplicate = await db
    .selectFrom("email_account")
    .select("id")
    .where("organizationId", "=", input.organizationId)
    .where("ownerUserId", "=", input.userId)
    .where("address", "=", input.address)
    .where("deletedAt", "is", null)
    .executeTakeFirst();
  if (duplicate) throw new EmailAccessError(409, "account_exists");
  const id = crypto.randomUUID();
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("email_account")
      .values({
        id,
        organizationId: input.organizationId,
        ownerUserId: input.userId,
        kind: input.kind,
        preset: input.preset,
        address: input.address,
        displayName: input.displayName,
        aliases: "[]",
        config: JSON.stringify(input.config),
        credentials: seal(input.credentials),
        syncCursor: "{}",
        backfillCursor: JSON.stringify(null),
        backfillProgress: "{}",
        lastError: null,
        lastSyncedAt: null,
        nextSyncAt: now,
        signatureHtml: null,
        color: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .execute();
    await trx
      .insertInto("email_account_member")
      .values({ id: crypto.randomUUID(), organizationId: input.organizationId, accountId: id, userId: input.userId, role: "owner", createdAt: now })
      .execute();
  });
  return id;
}

/** Verifies the IMAP + SMTP login before saving anything. */
export async function createImapAccount(organizationId: string, userId: string, body: Record<string, unknown>) {
  const address = String(body.address ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(address)) throw new EmailAccessError(400, "invalid_address");
  const preset = PRESETS.find((p) => p.id === body.preset && p.kind === "imap_smtp") ?? PRESETS.find((p) => p.id === "custom")!;
  const { config, credentials } = splitImapInput({ ...preset.defaults, ...((body.config as Record<string, unknown>) ?? {}), password: body.password });
  if (!credentials.password) throw new EmailAccessError(400, "password_required");
  await connectorFor("imap_smtp").verify({ address, config }, credentials);
  return insertAccount({
    organizationId,
    userId,
    kind: "imap_smtp",
    preset: preset.id,
    address,
    displayName: typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : null,
    config,
    credentials,
  });
}

/** OAuth callback: create the Gmail account, or refresh credentials on reconnect. */
export async function upsertGmailAccount(organizationId: string, userId: string, tokens: { refreshToken: string; accessToken: string; expiresAt: number }, reconnectId?: string | null) {
  const credentials = tokens as unknown as Record<string, unknown>;
  const profile = await gmailProfile({ credentials, saveCredentials: async () => {} });
  const address = profile.emailAddress.toLowerCase();
  if (reconnectId) {
    await requireAccountRole(organizationId, userId, reconnectId, "owner");
    const account = await loadAccount(reconnectId);
    if (account.address !== address) throw new EmailAccessError(400, "gmail_address_mismatch");
    await saveAccountCredentials(reconnectId, credentials);
    await db.updateTable("email_account").set({ nextSyncAt: new Date() }).where("id", "=", reconnectId).execute();
    await setAccountStatus(reconnectId, "active", null);
    return reconnectId;
  }
  const existing = await db
    .selectFrom("email_account")
    .select("id")
    .where("organizationId", "=", organizationId)
    .where("ownerUserId", "=", userId)
    .where("address", "=", address)
    .where("deletedAt", "is", null)
    .executeTakeFirst();
  if (existing) return upsertGmailAccount(organizationId, userId, tokens, existing.id);
  return insertAccount({ organizationId, userId, kind: "gmail", preset: "gmail", address, displayName: null, config: {}, credentials });
}

export async function updateAccount(organizationId: string, userId: string, accountId: string, body: Record<string, unknown>) {
  const role = await requireAccountRole(organizationId, userId, accountId, "member");
  const account = await loadAccount(accountId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (role === "owner") {
    if (typeof body.displayName === "string") patch.displayName = body.displayName.trim() || null;
    if (Array.isArray(body.aliases)) {
      patch.aliases = JSON.stringify([...new Set(body.aliases.map((a) => String(a).trim().toLowerCase()).filter((a) => /^[^@\s]+@[^@\s]+$/.test(a)))]);
    }
    if (typeof body.signatureHtml === "string") patch.signatureHtml = body.signatureHtml || null;
    if (typeof body.color === "string" || body.color === null) patch.color = body.color;
    if (typeof body.syncIntervalSec === "number") patch.syncIntervalSec = Math.max(30, Math.min(3600, Math.round(body.syncIntervalSec)));
    if (typeof body.paused === "boolean") {
      patch.status = body.paused ? "paused" : "active";
      patch.nextSyncAt = new Date();
    }
    if (account.kind === "imap_smtp" && (body.config || body.password)) {
      const { config, credentials } = splitImapInput({ ...account.config, ...((body.config as Record<string, unknown>) ?? {}), password: body.password ?? accountCredentials(account).password });
      await connectorFor("imap_smtp").verify({ address: account.address, config }, credentials);
      patch.config = JSON.stringify(config);
      patch.credentials = seal(credentials);
      patch.status = "active";
      patch.lastError = null;
    }
  }
  await db.updateTable("email_account").set(patch).where("id", "=", accountId).execute();
  if ("status" in patch) await broadcastEmailEvent(accountId, { type: "account.status", accountId, status: String(patch.status), lastError: null });
}

export async function testAccount(organizationId: string, userId: string, accountId: string) {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const account = await loadAccount(accountId);
  await connectorFor(account.kind).verify(account, accountCredentials(account), (next) => saveAccountCredentials(accountId, next));
}

/** Soft delete stops sync; purgeMail also wipes stored mail + bytes. */
export async function deleteAccount(organizationId: string, userId: string, accountId: string, purgeMail: boolean) {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const now = new Date();
  if (purgeMail) {
    const ids = await db.selectFrom("email_message").select("id").where("accountId", "=", accountId).where("purgedAt", "is", null).execute();
    for (let i = 0; i < ids.length; i += 200) await purgeMessages(ids.slice(i, i + 200).map((r) => r.id));
    await db.deleteFrom("email_account").where("id", "=", accountId).execute();
    return;
  }
  await db.updateTable("email_account").set({ deletedAt: now, credentials: null, status: "paused", updatedAt: now }).where("id", "=", accountId).execute();
}

export async function setBackfillPaused(organizationId: string, userId: string, accountId: string, paused: boolean) {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const account = await loadAccount(accountId);
  if (account.backfillState === "done") return;
  const state = paused ? "paused" : "running";
  await db.updateTable("email_account").set({ backfillState: state, updatedAt: new Date() }).where("id", "=", accountId).execute();
  await broadcastEmailEvent(accountId, { type: "account.backfill", accountId, state, progress: account.backfillProgress });
}

// ── sharing ────────────────────────────────────────────────────────────────

export async function listMembers(organizationId: string, userId: string, accountId: string) {
  await requireAccountRole(organizationId, userId, accountId, "viewer");
  return db
    .selectFrom("email_account_member")
    .innerJoin("user", "user.id", "email_account_member.userId")
    .select(["email_account_member.userId", "email_account_member.role", "user.name", "user.email", "email_account_member.createdAt"])
    .where("email_account_member.accountId", "=", accountId)
    .orderBy("email_account_member.createdAt")
    .execute();
}

export async function setVisibility(organizationId: string, userId: string, accountId: string, visibility: "private" | "shared") {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  await db.updateTable("email_account").set({ visibility, updatedAt: new Date() }).where("id", "=", accountId).execute();
  if (visibility === "private") {
    await db.deleteFrom("email_account_member").where("accountId", "=", accountId).where("role", "!=", "owner").execute();
  }
}

export async function upsertMember(organizationId: string, userId: string, accountId: string, memberUserId: string, role: "member" | "viewer") {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const account = await loadAccount(accountId);
  if (account.visibility !== "shared") throw new EmailAccessError(400, "account_not_shared");
  if (memberUserId === account.ownerUserId) throw new EmailAccessError(400, "owner_role_fixed");
  const inOrg = await db.selectFrom("member").select("id").where("organizationId", "=", organizationId).where("userId", "=", memberUserId).executeTakeFirst();
  if (!inOrg) throw new EmailAccessError(404, "user_not_in_organization");
  await db
    .insertInto("email_account_member")
    .values({ id: crypto.randomUUID(), organizationId, accountId, userId: memberUserId, role, createdAt: new Date() })
    .onConflict((oc) => oc.columns(["accountId", "userId"]).doUpdateSet({ role }))
    .execute();
}

export async function removeMember(organizationId: string, userId: string, accountId: string, memberUserId: string) {
  const account = await loadAccount(accountId);
  if (memberUserId !== userId) await requireAccountRole(organizationId, userId, accountId, "owner");
  if (memberUserId === account.ownerUserId) throw new EmailAccessError(400, "owner_role_fixed");
  await db.deleteFrom("email_account_member").where("accountId", "=", accountId).where("userId", "=", memberUserId).execute();
}
