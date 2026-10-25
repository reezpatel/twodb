import type { WSContext } from "hono/ws";
import type { Selectable } from "kysely";
import type { TeamsAccountConfig, TeamsEvent, TeamsLiveInput } from "@twodb/runner-core";
import { db } from "../../auth";
import type { TeamsAccountTable } from "../../plugins/db";
import { logger } from "../logger";
import { runnerManager } from "../runner-manager";
import { notify } from "../notifications/notify";

/**
 * Teams bridge orchestrator (server side). Runners host the Chromium
 * sessions; this module decides which account runs where, reconciles on
 * runner connect/disconnect, turns runner events into notifications, and
 * relays the live view (screencast + input) between desktop clients and
 * runners for interactive sign-in (2FA).
 */

export type TeamsAccountRow = Selectable<TeamsAccountTable>;

const TEAMS_HOME = "https://teams.microsoft.com";

function configOf(account: TeamsAccountRow): TeamsAccountConfig {
  return { id: account.id, label: account.label, email: account.email };
}

async function setStatus(accountId: string, status: string, lastError?: string | null) {
  await db
    .updateTable("teams_account")
    .set({ status, lastError: lastError ?? null, updatedAt: new Date() })
    .where("id", "=", accountId)
    .execute();
}

// --- live view relay ----------------------------------------------------------

interface LiveView {
  viewId: string;
  accountId: string;
  runnerId: string;
  client: WSContext;
}

const liveViews = new Map<string, LiveView>(); // viewId → view
const liveByAccount = new Map<string, string>(); // accountId → viewId (1 viewer per account)

function sendJson(ws: WSContext, msg: unknown) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // socket gone — close handling cleans up
  }
}

/** Attach a desktop client to an account's browser screen. Returns false when
 *  the account's runner is offline or another viewer is attached. */
export function liveAttach(account: TeamsAccountRow, client: WSContext): string | null {
  if (liveByAccount.has(account.id)) return null;
  if (!runnerManager.onlineIds().has(account.runnerId)) return null;
  const viewId = crypto.randomUUID();
  liveViews.set(viewId, { viewId, accountId: account.id, runnerId: account.runnerId, client });
  liveByAccount.set(account.id, viewId);
  runnerManager.sendToRunnerRaw(account.runnerId, { type: "teamsLiveStart", teamsAccountId: account.id, viewId });
  return viewId;
}

export function liveDetach(viewId: string) {
  const view = liveViews.get(viewId);
  if (!view) return;
  liveViews.delete(viewId);
  liveByAccount.delete(view.accountId);
  runnerManager.sendToRunnerRaw(view.runnerId, { type: "teamsLiveStop", teamsAccountId: view.accountId, viewId });
}

export function liveInput(viewId: string, input: TeamsLiveInput) {
  const view = liveViews.get(viewId);
  if (!view) return;
  runnerManager.sendToRunnerRaw(view.runnerId, { type: "teamsLiveInput", teamsAccountId: view.accountId, viewId, input });
}

// --- account lifecycle --------------------------------------------------------

/** Push a start command for an account whose runner is online. */
export function startAccount(account: TeamsAccountRow) {
  if (!runnerManager.onlineIds().has(account.runnerId)) {
    void setStatus(account.id, "runner_offline");
    return false;
  }
  runnerManager.sendToRunnerRaw(account.runnerId, { type: "teamsStart", teamsAccount: configOf(account) });
  void setStatus(account.id, "starting");
  return true;
}

export function stopAccount(account: TeamsAccountRow) {
  runnerManager.sendToRunnerRaw(account.runnerId, { type: "teamsStop", teamsAccountId: account.id });
  void setStatus(account.id, "idle");
}

/** Runner connected → (re)start its enabled accounts; disconnected → mark
 *  them runner_offline. Wired to runnerManager.onChange by index.ts. */
export async function reconcileRunner(runnerId: string) {
  const online = runnerManager.onlineIds().has(runnerId);
  const accounts = await db.selectFrom("teams_account").selectAll().where("runnerId", "=", runnerId).execute();
  for (const account of accounts) {
    if (!account.enabled) continue;
    if (online) startAccount(account);
    else void setStatus(account.id, "runner_offline");
  }
}

const prevOnline = new Set<string>();

/** Diff the runner roster on change: start accounts on newly-online runners,
 *  mark accounts on newly-offline ones. Avoids restarting healthy readers
 *  every time an unrelated runner flaps. */
export function handleRunnerRosterChange() {
  const now = runnerManager.onlineIds();
  for (const runnerId of now) {
    if (!prevOnline.has(runnerId)) void reconcileRunner(runnerId);
  }
  for (const runnerId of prevOnline) {
    if (!now.has(runnerId)) {
      void db
        .updateTable("teams_account")
        .set({ status: "runner_offline", updatedAt: new Date() })
        .where("runnerId", "=", runnerId)
        .where("enabled", "=", true)
        .execute();
    }
  }
  prevOnline.clear();
  for (const id of now) prevOnline.add(id);
}

export async function reconcileAll() {
  const accounts = await db.selectFrom("teams_account").selectAll().where("enabled", "=", true).execute();
  for (const account of accounts) {
    if (runnerManager.onlineIds().has(account.runnerId)) startAccount(account);
    else void setStatus(account.id, "runner_offline");
  }
}

// --- runner → server messages ---------------------------------------------------

export async function handleTeamsRunnerMessage(runnerId: string, msg: { type: string; teamsAccountId?: string; status?: string; error?: string; event?: TeamsEvent; viewId?: string; dataBase64?: string }) {
  if (msg.type === "teamsLiveFrame") {
    const view = msg.viewId ? liveViews.get(msg.viewId) : undefined;
    if (view && msg.dataBase64) sendJson(view.client, { type: "frame", dataBase64: msg.dataBase64 });
    return;
  }

  const accountId = msg.teamsAccountId;
  if (!accountId) return;
  const account = await db.selectFrom("teams_account").selectAll().where("id", "=", accountId).executeTakeFirst();
  if (!account || account.runnerId !== runnerId) return;

  if (msg.type === "teamsStatus") {
    await handleStatus(account, msg.status ?? "idle", msg.error ?? null);
    return;
  }
  if (msg.type === "teamsEvent" && msg.event) {
    await handleEvent(account, msg.event);
    return;
  }
}

async function handleStatus(account: TeamsAccountRow, status: string, error: string | null) {
  logger.info({ accountId: account.id, label: account.label, status, error }, "teams account status");
  await setStatus(account.id, status, error);

  if (status === "auth_required") {
    await notify({
      organizationId: account.organizationId,
      type: "teams.auth",
      audience: { kind: "user", userId: account.userId },
      title: `Teams sign-in needed — ${account.label}`,
      body: error ?? "The session needs interactive sign-in (password / 2FA). Open the connect screen to continue.",
      dedupeKey: `teams.auth:${account.id}`,
      actions: [{ id: "connect", label: "Open connect screen", verb: "link", deepLink: "/apps/settings/teams" }],
      data: { accountId: account.id },
    });
  }
}

async function handleEvent(account: TeamsAccountRow, event: TeamsEvent) {
  await db.updateTable("teams_account").set({ lastEventAt: new Date() }).where("id", "=", account.id).execute();

  const audience = { kind: "user", userId: account.userId } as const;
  const url = event.url ?? TEAMS_HOME;
  const open = [{ id: "open", label: "Open in Teams", verb: "link" as const, deepLink: url }];

  if (event.kind === "call") {
    const who = event.sender ?? event.chatName ?? "Unknown caller";
    const incoming = event.callState === "incoming";
    await notify({
      organizationId: account.organizationId,
      type: "teams.call",
      audience,
      title: incoming ? `Incoming call — ${who}` : event.callState === "missed" ? `Missed call — ${who}` : `Call ended — ${who}`,
      body: `${account.label}${event.text ? ` · ${event.text}` : ""}`,
      urgency: incoming ? "critical" : "high",
      dedupeKey: `teams:${account.id}:${event.id}`,
      groupingKey: `teams.call:${account.id}`,
      actions: open,
      data: { accountId: account.id, callState: event.callState ?? null },
    });
    return;
  }

  const type = event.kind === "mention" ? "teams.mention" : "teams.message";
  await notify({
    organizationId: account.organizationId,
    type,
    audience,
    title: event.sender ?? event.chatName ?? "Teams message",
    body: event.text ?? "",
    dedupeKey: `teams:${account.id}:${event.id}`,
    groupingKey: `teams.chat:${account.id}:${event.chatName ?? event.sender ?? "unknown"}`,
    actor: event.sender ? { name: event.sender } : undefined,
    actions: open,
    data: { accountId: account.id, chatName: event.chatName ?? null, ts: event.ts ?? null },
  });
}
