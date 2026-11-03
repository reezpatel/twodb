import type { SettingsAccount, AccountSyncLine } from "@/components/blocks/settings/accounts/settings-accounts";
import { initials, type EmailAccount } from "../../email/email-api";

const PROVIDER: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  icloud: "iCloud",
  fastmail: "Fastmail",
  yahoo: "Yahoo",
  nextcloud: "Nextcloud",
  custom: "IMAP / CalDAV",
};

function relative(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function mailLine(account: EmailAccount): AccountSyncLine {
  const { done = 0, total } = account.backfillProgress;
  const importing = account.backfillState === "running" || account.backfillState === "paused";
  const paused = account.backfillState === "paused";
  const history = account.backfillState === "done" ? ` · history imported (${done.toLocaleString()} messages)` : "";
  return {
    kind: "mail",
    state: account.status,
    summary: `last checked ${relative(account.lastSyncedAt)}${history}`,
    progress: importing
      ? {
          value: total ? Math.min(100, Math.round((done / total) * 100)) : 0,
          label: `${done.toLocaleString()}${total ? ` / ${total.toLocaleString()}` : ""} ${paused ? "· paused" : "importing history"}`,
          paused,
        }
      : undefined,
    canTogglePause: importing && account.role === "owner",
    error: account.lastError,
  };
}

function calendarLine(account: EmailAccount): AccountSyncLine {
  const p = account.calendarImportProgress;
  const running = account.calendarImportState === "running";
  return {
    kind: "calendar",
    state: account.calendarState,
    summary: `${running ? `importing · ${p.done?.toLocaleString() ?? 0} events (calendar ${p.calendar ?? 1} of ${p.calendars ?? "?"})` : `last checked ${relative(account.calendarLastSyncedAt)}`}${account.syncMode === "webhooks" ? " · push" : ""}`,
    progress: running ? { value: p.calendars ? ((p.calendar ?? 0) / p.calendars) * 100 : 5, label: "" } : undefined,
    error: account.calendarError,
  };
}

/** Maps a synced email account onto the settings block's presentational shape. */
export function toSettingsAccount(account: EmailAccount, testResult?: string): SettingsAccount {
  const mail = account.capabilities.includes("mail");
  const calendar = account.capabilities.includes("calendar");
  return {
    id: account.id,
    name: account.displayName ? `${account.displayName} · ${account.address}` : account.address,
    initials: initials(account.displayName ?? account.address),
    provider: PROVIDER[account.preset ?? ""] ?? account.kind,
    shared: account.visibility === "shared",
    role: account.role === "owner" ? null : account.role,
    owner: account.role === "owner",
    mail,
    calendar,
    lines: [...(mail ? [mailLine(account)] : []), ...(calendar ? [calendarLine(account)] : [])],
    needsReconnect: account.status === "reauth_required" || account.calendarState === "reauth_required",
    reconnectLabel: account.kind === "google" ? "Google" : account.kind === "microsoft" ? "Microsoft" : null,
    testResult,
  };
}
