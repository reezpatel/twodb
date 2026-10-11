import { Calendar, KeyRound, Mail, MoreHorizontal, Pause, Pencil, Play, RefreshCw, Share2, Trash2, Upload, Users, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { initials, type AccountCapability, type EmailAccount } from "../../email/email-api";

const PROVIDER: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  icloud: "iCloud",
  fastmail: "Fastmail",
  yahoo: "Yahoo",
  nextcloud: "Nextcloud",
  custom: "IMAP / CalDAV",
};

const STATE: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
  active: { label: "Syncing", variant: "success" },
  error: { label: "Error", variant: "destructive" },
  reauth_required: { label: "Reconnect needed", variant: "warning" },
  paused: { label: "Paused", variant: "secondary" },
  disabled: { label: "Off", variant: "secondary" },
};

export function relative(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function MailLine({ account, onBackfill }: { account: EmailAccount; onBackfill: (op: "pause" | "resume") => void }) {
  const state = STATE[account.status] ?? STATE.active;
  const { done = 0, total } = account.backfillProgress;
  const importing = account.backfillState === "running" || account.backfillState === "paused";
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Mail size={12} /> Mail
        <Badge variant={state.variant}>{state.label}</Badge>
        last checked {relative(account.lastSyncedAt)}
        {account.backfillState === "done" ? ` · history imported (${done.toLocaleString()} messages)` : ""}
      </span>
      {importing ? (
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {done.toLocaleString()}
            {total ? ` / ${total.toLocaleString()}` : ""} {account.backfillState === "paused" ? "· paused" : "importing history"}
          </span>
          {account.role === "owner" ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={account.backfillState === "paused" ? "Resume history import" : "Pause history import"}
              onClick={() => onBackfill(account.backfillState === "paused" ? "resume" : "pause")}
            >
              {account.backfillState === "paused" ? <Play /> : <Pause />}
            </Button>
          ) : null}
        </div>
      ) : null}
      {account.lastError ? <p className="text-destructive text-xs break-words">{account.lastError}</p> : null}
    </div>
  );
}

function CalendarLine({ account }: { account: EmailAccount }) {
  const state = STATE[account.calendarState] ?? STATE.active;
  const p = account.calendarImportProgress;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Calendar size={12} /> Calendar
        <Badge variant={state.variant}>{state.label}</Badge>
        {account.calendarImportState === "running"
          ? `importing · ${p.done?.toLocaleString() ?? 0} events (calendar ${p.calendar ?? 1} of ${p.calendars ?? "?"})`
          : `last checked ${relative(account.calendarLastSyncedAt)}`}
        {account.syncMode === "webhooks" ? " · push" : ""}
      </span>
      {account.calendarImportState === "running" ? <Progress value={p.calendars ? ((p.calendar ?? 0) / p.calendars) * 100 : 5} className="h-1.5" /> : null}
      {account.calendarError ? <p className="text-destructive text-xs break-words">{account.calendarError}</p> : null}
    </div>
  );
}

export function AccountRow({
  account,
  testResult,
  onToggleCapability,
  onSync,
  onTest,
  onEdit,
  onShare,
  onReconnect,
  onImport,
  onRemove,
  onBackfill,
}: {
  account: EmailAccount;
  testResult?: string;
  onToggleCapability: (capability: AccountCapability, on: boolean) => void;
  onSync: () => void;
  onTest: () => void;
  onEdit: () => void;
  onShare: () => void;
  onReconnect: () => void;
  onImport: () => void;
  onRemove: () => void;
  onBackfill: (op: "pause" | "resume") => void;
}) {
  const owner = account.role === "owner";
  const needsReconnect = account.status === "reauth_required" || account.calendarState === "reauth_required";
  const hasMail = account.capabilities.includes("mail");
  const hasCalendar = account.capabilities.includes("calendar");
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="text-xs">{initials(account.displayName ?? account.address)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <strong className="truncate text-sm font-medium">{account.displayName ? `${account.displayName} · ${account.address}` : account.address}</strong>
            <Badge variant="outline">{PROVIDER[account.preset ?? ""] ?? account.kind}</Badge>
            {account.visibility === "shared" ? (
              <Badge variant="secondary">
                <Users /> shared
              </Badge>
            ) : null}
            {!owner ? <Badge variant="secondary">{account.role}</Badge> : null}
          </span>
          {testResult ? <span className="text-muted-foreground text-xs">{testResult}</span> : null}
        </div>
        {owner ? (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Mail size={13} /> Mail
              <Switch checked={hasMail} disabled={hasMail && !hasCalendar} onCheckedChange={(v) => onToggleCapability("mail", v)} />
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Calendar size={13} /> Calendar
              <Switch checked={hasCalendar} disabled={hasCalendar && !hasMail} onCheckedChange={(v) => onToggleCapability("calendar", v)} />
            </label>
          </div>
        ) : null}
        {needsReconnect && owner ? (
          <Button size="sm" variant="outline" onClick={account.kind === "imap" ? onEdit : onReconnect}>
            <Zap /> Reconnect
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Account actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onSync}>
              <RefreshCw /> Sync now
            </DropdownMenuItem>
            {owner ? (
              <>
                <DropdownMenuItem onSelect={onTest}>
                  <Zap /> Test connection
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onShare}>
                  <Share2 /> Sharing
                </DropdownMenuItem>
                {account.kind !== "imap" ? (
                  <DropdownMenuItem onSelect={onReconnect}>
                    <KeyRound /> Reconnect {account.kind === "google" ? "Google" : "Microsoft"}
                  </DropdownMenuItem>
                ) : null}
                {hasMail ? (
                  <DropdownMenuItem onSelect={onImport}>
                    <Upload /> Import .eml files
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                  <Trash2 /> Remove account
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onSelect={onShare}>
                <Users /> Members
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasMail ? <MailLine account={account} onBackfill={onBackfill} /> : null}
      {hasCalendar ? <CalendarLine account={account} /> : null}
    </div>
  );
}
