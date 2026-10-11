import { sql } from "kysely";
import { db } from "../../auth";
import { broadcastEmailEvent } from "../../routes/email-ws";
import { EmailAccessError, accessibleAccounts, requireAccountRole, type EmailRole } from "./access";
import { connectorFor, IMAP_FIELDS, PRESETS } from "./connectors/registry";
import { gmailProfile } from "./connectors/gmail";
import { graphProfile } from "./connectors/graph-mail";
import { seal, unseal } from "./crypto";
import { googleCapabilitiesFor } from "./gmail-oauth";
import { purgeMessages } from "./threads";
import type { AccountCapability, EmailAccountRow } from "./types";
import { ensureAccountBook, setBookDeleted } from "../contacts/books";
import { verifyCaldav } from "../calendar/connectors/caldav";
import { microsoftCapabilitiesFor } from "../accounts/microsoft-oauth";

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
  capabilities: AccountCapability[];
  /** Capabilities the stored OAuth grant covers (password accounts: all). */
  grantedCapabilities: AccountCapability[];
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  backfillState: string;
  backfillProgress: Record<string, unknown>;
  calendarState: string;
  calendarError: string | null;
  calendarImportState: string;
  calendarImportProgress: Record<string, unknown>;
  calendarLastSyncedAt: string | null;
  syncMode: string;
  suggestOrgMembers: boolean;
  syncIntervalSec: number;
  signatureHtml: string | null;
  color: string | null;
  hasCredentials: boolean;
  createdAt: string;
}

const ALL_CAPABILITIES: AccountCapability[] = ["mail", "calendar"];

export function grantedCapabilities(a: Pick<EmailAccountRow, "kind" | "grantedScopes">): AccountCapability[] {
  if (a.kind === "google") return a.grantedScopes.length ? googleCapabilitiesFor(a.grantedScopes) : ["mail"];
  if (a.kind === "microsoft") return microsoftCapabilitiesFor(a.grantedScopes);
  return ALL_CAPABILITIES;
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
    capabilities: a.capabilities as AccountCapability[],
    grantedCapabilities: grantedCapabilities(a),
    status: a.status,
    lastError: a.lastError,
    lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
    backfillState: a.backfillState,
    backfillProgress: a.backfillProgress,
    calendarState: a.calendarState,
    calendarError: a.calendarError,
    calendarImportState: a.calendarImportState,
    calendarImportProgress: a.calendarImportProgress,
    calendarLastSyncedAt: a.calendarLastSyncedAt?.toISOString() ?? null,
    syncMode: a.syncMode,
    suggestOrgMembers: a.suggestOrgMembers,
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
  const rows = await db
    .selectFrom("connected_account")
    .selectAll()
    .where("id", "in", [...roles.keys()])
    .orderBy("position")
    .orderBy("createdAt")
    .execute();
  return rows.map((r) => serializeAccount(r, roles.get(r.id) as EmailRole));
}

export async function loadAccount(accountId: string): Promise<EmailAccountRow> {
  const row = await db.selectFrom("connected_account").selectAll().where("id", "=", accountId).executeTakeFirst();
  if (!row || row.deletedAt) throw new EmailAccessError(404, "account_not_found");
  return row;
}

export function accountCredentials(account: EmailAccountRow): Record<string, unknown> {
  return unseal<Record<string, unknown>>(account.credentials) ?? {};
}

export async function saveAccountCredentials(accountId: string, credentials: Record<string, unknown>) {
  await db
    .updateTable("connected_account")
    .set({ credentials: seal(credentials), updatedAt: new Date() })
    .where("id", "=", accountId)
    .execute();
}

export async function setAccountStatus(accountId: string, status: string, lastError: string | null) {
  await db.updateTable("connected_account").set({ status, lastError, updatedAt: new Date() }).where("id", "=", accountId).execute();
  await broadcastEmailEvent(accountId, { type: "account.status", accountId, status, lastError });
}

export async function setCalendarState(accountId: string, calendarState: string, calendarError: string | null) {
  await db.updateTable("connected_account").set({ calendarState, calendarError, updatedAt: new Date() }).where("id", "=", accountId).execute();
  await broadcastEmailEvent(accountId, { type: "account.calendar", accountId, calendarState, calendarError });
}

function splitImapInput(input: Record<string, unknown>, capabilities: AccountCapability[]) {
  const config: Record<string, unknown> = {};
  const credentials: Record<string, unknown> = {};
  for (const field of IMAP_FIELDS) {
    const value = input[field.key];
    if (value === undefined || value === "" || value === null) continue;
    if (field.capability && !capabilities.includes(field.capability)) continue;
    const coerced = field.type === "number" ? Number(value) : field.type === "boolean" ? value === true || value === "true" : String(value).trim();
    if (field.secret) credentials[field.key] = coerced;
    else config[field.key] = coerced;
  }
  return { config, credentials };
}

function parseCapabilities(value: unknown, allowed: AccountCapability[]): AccountCapability[] {
  const list = Array.isArray(value) ? value.filter((c): c is AccountCapability => c === "mail" || c === "calendar") : allowed;
  const picked = [...new Set(list)].filter((c) => allowed.includes(c));
  if (!picked.length) throw new EmailAccessError(400, "capability_required");
  return picked;
}

function twoYearsAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

function capabilityColumns(capabilities: AccountCapability[], now: Date) {
  const calendar = capabilities.includes("calendar");
  return {
    capabilities,
    calendarState: calendar ? "active" : "disabled",
    calendarImportState: "pending",
    calendarImportFrom: calendar ? twoYearsAgo() : null,
    calendarNextSyncAt: calendar ? now : null,
  };
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
  capabilities: AccountCapability[];
  grantedScopes?: string[];
}) {
  const existing = await db
    .selectFrom("connected_account")
    .select(["id", "deletedAt"])
    .where("organizationId", "=", input.organizationId)
    .where("ownerUserId", "=", input.userId)
    .where("address", "=", input.address)
    .orderBy(sql`"deletedAt" is null`, "desc")
    .executeTakeFirst();
  if (existing && !existing.deletedAt) throw new EmailAccessError(409, "account_exists");
  const now = new Date();

  // Reconnecting a removed login reactivates it, so its mail, calendars and contact book come back.
  if (existing) {
    await db
      .updateTable("connected_account")
      .set({
        kind: input.kind,
        preset: input.preset,
        config: JSON.stringify(input.config),
        credentials: seal(input.credentials),
        grantedScopes: input.grantedScopes ?? [],
        status: "active",
        lastError: null,
        nextSyncAt: now,
        deletedAt: null,
        updatedAt: now,
        ...capabilityColumns(input.capabilities, now),
      })
      .where("id", "=", existing.id)
      .execute();
    await setBookDeleted(existing.id, false);
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("connected_account")
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
        grantedScopes: input.grantedScopes ?? [],
        syncCursor: "{}",
        backfillCursor: JSON.stringify(null),
        backfillProgress: "{}",
        calendarImportProgress: "{}",
        lastError: null,
        calendarError: null,
        lastSyncedAt: null,
        nextSyncAt: now,
        calendarListSyncedAt: null,
        calendarLastSyncedAt: null,
        signatureHtml: null,
        color: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...capabilityColumns(input.capabilities, now),
      })
      .execute();
    await trx
      .insertInto("connected_account_member")
      .values({ id: crypto.randomUUID(), organizationId: input.organizationId, accountId: id, userId: input.userId, role: "owner", createdAt: now })
      .execute();
  });
  await ensureAccountBook(input.organizationId, id, input.userId);
  return id;
}

async function verifyPasswordAccount(
  address: string,
  config: Record<string, unknown>,
  credentials: Record<string, unknown>,
  capabilities: AccountCapability[],
) {
  if (capabilities.includes("mail")) {
    if (!config.imapHost || !config.smtpHost) throw new EmailAccessError(400, "imap_smtp_hosts_required");
    await connectorFor("imap").verify({ address, config }, credentials);
  }
  if (capabilities.includes("calendar")) {
    if (!config.caldavUrl) throw new EmailAccessError(400, "caldav_url_required");
    await verifyCaldav({ address, config }, credentials);
  }
}

/** Password presets (iCloud, Fastmail, Yahoo, Nextcloud, custom): verifies every enabled capability before saving. */
export async function createPasswordAccount(organizationId: string, userId: string, body: Record<string, unknown>) {
  const address = String(body.address ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(address)) throw new EmailAccessError(400, "invalid_address");
  const preset = PRESETS.find((p) => p.id === body.preset && p.kind === "imap") ?? PRESETS.find((p) => p.id === "custom")!;
  const capabilities = parseCapabilities(body.capabilities, preset.capabilities);
  const { config, credentials } = splitImapInput(
    { ...preset.defaults, ...((body.config as Record<string, unknown>) ?? {}), password: body.password },
    capabilities,
  );
  if (!credentials.password) throw new EmailAccessError(400, "password_required");
  await verifyPasswordAccount(address, config, credentials, capabilities);
  return insertAccount({
    organizationId,
    userId,
    kind: "imap",
    preset: preset.id,
    address,
    displayName: typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : null,
    config,
    credentials,
    capabilities,
  });
}

/** @deprecated name kept for the existing route; password accounts now cover CalDAV too. */
export const createImapAccount = createPasswordAccount;

interface OAuthTokens {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

/** Shared OAuth upsert: create, or refresh credentials + scopes on reconnect / capability upgrade. */
async function upsertOAuthAccount(
  kind: "google" | "microsoft",
  organizationId: string,
  userId: string,
  address: string,
  displayName: string | null,
  tokens: OAuthTokens,
  requested: AccountCapability[],
  reconnectId?: string | null,
): Promise<string> {
  const credentials = { refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  const targetId =
    reconnectId ??
    (
      await db
        .selectFrom("connected_account")
        .select("id")
        .where("organizationId", "=", organizationId)
        .where("ownerUserId", "=", userId)
        .where("address", "=", address)
        .where("deletedAt", "is", null)
        .executeTakeFirst()
    )?.id;

  if (targetId) {
    await requireAccountRole(organizationId, userId, targetId, "owner");
    const account = await loadAccount(targetId);
    if (account.address !== address) throw new EmailAccessError(400, `${kind}_address_mismatch`);
    const granted = [...new Set([...account.grantedScopes, ...tokens.scopes])];
    const covered = grantedCapabilities({ kind, grantedScopes: granted });
    const capabilities = [...new Set([...(account.capabilities as AccountCapability[]), ...requested])].filter((c) => covered.includes(c));
    const now = new Date();
    const enablingCalendar = capabilities.includes("calendar") && !account.capabilities.includes("calendar");
    await db
      .updateTable("connected_account")
      .set({
        credentials: seal(credentials),
        grantedScopes: granted,
        capabilities,
        status: "active",
        lastError: null,
        nextSyncAt: now,
        updatedAt: now,
        ...(enablingCalendar ? { calendarState: "active", calendarImportState: "pending", calendarImportFrom: twoYearsAgo(), calendarNextSyncAt: now } : {}),
        ...(capabilities.includes("calendar") && account.calendarState === "reauth_required"
          ? { calendarState: "active", calendarError: null, calendarNextSyncAt: now }
          : {}),
      })
      .where("id", "=", targetId)
      .execute();
    await broadcastEmailEvent(targetId, { type: "account.status", accountId: targetId, status: "active", lastError: null });
    return targetId;
  }

  const covered = grantedCapabilities({ kind, grantedScopes: tokens.scopes });
  const capabilities = requested.filter((c) => covered.includes(c));
  if (!capabilities.length) throw new EmailAccessError(400, "scopes_not_granted");
  return insertAccount({
    organizationId,
    userId,
    kind,
    preset: kind,
    address,
    displayName,
    config: {},
    credentials,
    capabilities,
    grantedScopes: tokens.scopes,
  });
}

export async function upsertGoogleAccount(
  organizationId: string,
  userId: string,
  tokens: OAuthTokens,
  requested: AccountCapability[],
  reconnectId?: string | null,
) {
  const ctx = { credentials: tokens as unknown as Record<string, unknown>, saveCredentials: async () => {} };
  const address = await googleAddress(ctx, tokens.scopes);
  return upsertOAuthAccount("google", organizationId, userId, address, null, tokens, requested, reconnectId);
}

async function googleAddress(ctx: { credentials: Record<string, unknown>; saveCredentials: (n: Record<string, unknown>) => Promise<void> }, scopes: string[]) {
  if (scopes.some((s) => s.includes("gmail"))) return (await gmailProfile(ctx)).emailAddress.toLowerCase();
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${String(ctx.credentials.accessToken)}` } });
  const info = (await res.json()) as { email?: string };
  if (!info.email) throw new Error("google_email_unavailable");
  return info.email.toLowerCase();
}

/** Kept for the existing Gmail OAuth callback signature. */
export async function upsertGmailAccount(organizationId: string, userId: string, tokens: OAuthTokens, reconnectId?: string | null) {
  return upsertGoogleAccount(organizationId, userId, tokens, ["mail"], reconnectId);
}

export async function upsertMicrosoftAccount(
  organizationId: string,
  userId: string,
  tokens: OAuthTokens,
  requested: AccountCapability[],
  reconnectId?: string | null,
) {
  const profile = await graphProfile({ credentials: tokens as unknown as Record<string, unknown>, saveCredentials: async () => {} });
  const address = (profile.mail ?? profile.userPrincipalName).toLowerCase();
  return upsertOAuthAccount("microsoft", organizationId, userId, address, profile.displayName, tokens, requested, reconnectId);
}

/**
 * Turns capabilities on/off. Returns needsAuth when an OAuth account's grant
 * doesn't cover a newly requested capability (the UI then re-runs consent).
 */
export async function setCapabilities(
  organizationId: string,
  userId: string,
  accountId: string,
  requested: AccountCapability[],
): Promise<{ needsAuth: boolean }> {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const account = await loadAccount(accountId);
  const capabilities = parseCapabilities(requested, ALL_CAPABILITIES);
  if (account.kind !== "imap") {
    const covered = grantedCapabilities(account);
    if (capabilities.some((c) => !covered.includes(c))) return { needsAuth: true };
  } else {
    const added = capabilities.filter((c) => !account.capabilities.includes(c));
    if (added.length) await verifyPasswordAccount(account.address, account.config, accountCredentials(account), added);
  }
  const now = new Date();
  const enablingCalendar = capabilities.includes("calendar") && !account.capabilities.includes("calendar");
  await db
    .updateTable("connected_account")
    .set({
      capabilities,
      updatedAt: now,
      ...(capabilities.includes("mail") && !account.capabilities.includes("mail") ? { nextSyncAt: now, status: "active", lastError: null } : {}),
      ...(enablingCalendar
        ? {
            calendarState: "active",
            calendarError: null,
            calendarImportState: account.calendarImportState === "done" ? "done" : "pending",
            calendarImportFrom: twoYearsAgo(),
            calendarNextSyncAt: now,
          }
        : {}),
      ...(!capabilities.includes("calendar") ? { calendarState: "disabled" } : {}),
    })
    .where("id", "=", accountId)
    .execute();
  await broadcastEmailEvent(accountId, { type: "account.status", accountId, status: account.status, lastError: account.lastError });
  return { needsAuth: false };
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
    if (body.syncMode === "polling" || body.syncMode === "webhooks") patch.syncMode = body.syncMode;
    if (typeof body.suggestOrgMembers === "boolean") patch.suggestOrgMembers = body.suggestOrgMembers;
    if (typeof body.paused === "boolean") {
      patch.status = body.paused ? "paused" : "active";
      patch.nextSyncAt = new Date();
    }
    if (typeof body.calendarPaused === "boolean" && account.capabilities.includes("calendar")) {
      patch.calendarState = body.calendarPaused ? "paused" : "active";
      patch.calendarNextSyncAt = new Date();
    }
    if (account.kind === "imap" && (body.config || body.password)) {
      const caps = account.capabilities as AccountCapability[];
      const { config, credentials } = splitImapInput(
        { ...account.config, ...((body.config as Record<string, unknown>) ?? {}), password: body.password ?? accountCredentials(account).password },
        caps,
      );
      await verifyPasswordAccount(account.address, config, credentials, caps);
      patch.config = JSON.stringify(config);
      patch.credentials = seal(credentials);
      patch.status = "active";
      patch.lastError = null;
      if (caps.includes("calendar")) {
        patch.calendarState = "active";
        patch.calendarError = null;
      }
    }
  }
  await db.updateTable("connected_account").set(patch).where("id", "=", accountId).execute();
  if ("status" in patch) await broadcastEmailEvent(accountId, { type: "account.status", accountId, status: String(patch.status), lastError: null });
}

export async function testAccount(organizationId: string, userId: string, accountId: string) {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const account = await loadAccount(accountId);
  const credentials = accountCredentials(account);
  const save = (next: Record<string, unknown>) => saveAccountCredentials(accountId, next);
  if (account.capabilities.includes("mail")) await connectorFor(account.kind).verify(account, credentials, save);
  if (account.capabilities.includes("calendar") && account.kind === "imap") await verifyCaldav(account, credentials);
}

/** Soft delete stops sync and hides the contact book; purge also wipes stored mail, calendars and bytes. */
export async function deleteAccount(organizationId: string, userId: string, accountId: string, purgeMail: boolean) {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const now = new Date();
  if (purgeMail) {
    const ids = await db.selectFrom("email_message").select("id").where("accountId", "=", accountId).where("purgedAt", "is", null).execute();
    for (let i = 0; i < ids.length; i += 200) await purgeMessages(ids.slice(i, i + 200).map((r) => r.id));
    await db.deleteFrom("connected_account").where("id", "=", accountId).execute();
    return;
  }
  await db
    .updateTable("connected_account")
    .set({ deletedAt: now, credentials: null, status: "paused", calendarState: "paused", updatedAt: now })
    .where("id", "=", accountId)
    .execute();
  await setBookDeleted(accountId, true);
}

export async function setBackfillPaused(organizationId: string, userId: string, accountId: string, paused: boolean) {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  const account = await loadAccount(accountId);
  if (account.backfillState === "done") return;
  const state = paused ? "paused" : "running";
  await db.updateTable("connected_account").set({ backfillState: state, updatedAt: new Date() }).where("id", "=", accountId).execute();
  await broadcastEmailEvent(accountId, { type: "account.backfill", accountId, state, progress: account.backfillProgress });
}

// ── sharing ────────────────────────────────────────────────────────────────

export async function listMembers(organizationId: string, userId: string, accountId: string) {
  await requireAccountRole(organizationId, userId, accountId, "viewer");
  return db
    .selectFrom("connected_account_member")
    .innerJoin("user", "user.id", "connected_account_member.userId")
    .select(["connected_account_member.userId", "connected_account_member.role", "user.name", "user.email", "connected_account_member.createdAt"])
    .where("connected_account_member.accountId", "=", accountId)
    .orderBy("connected_account_member.createdAt")
    .execute();
}

export async function setVisibility(organizationId: string, userId: string, accountId: string, visibility: "private" | "shared") {
  await requireAccountRole(organizationId, userId, accountId, "owner");
  await db.updateTable("connected_account").set({ visibility, updatedAt: new Date() }).where("id", "=", accountId).execute();
  if (visibility === "private") {
    await db.deleteFrom("connected_account_member").where("accountId", "=", accountId).where("role", "!=", "owner").execute();
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
    .insertInto("connected_account_member")
    .values({ id: crypto.randomUUID(), organizationId, accountId, userId: memberUserId, role, createdAt: new Date() })
    .onConflict((oc) => oc.columns(["accountId", "userId"]).doUpdateSet({ role }))
    .execute();
}

export async function removeMember(organizationId: string, userId: string, accountId: string, memberUserId: string) {
  const account = await loadAccount(accountId);
  if (memberUserId !== userId) await requireAccountRole(organizationId, userId, accountId, "owner");
  if (memberUserId === account.ownerUserId) throw new EmailAccessError(400, "owner_role_fixed");
  await db.deleteFrom("connected_account_member").where("accountId", "=", accountId).where("userId", "=", memberUserId).execute();
}
