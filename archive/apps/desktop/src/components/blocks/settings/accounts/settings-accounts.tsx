import type { ComponentProps } from "react";
import { AtSign, Calendar, KeyRound, Mail, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Share2, Trash2, Upload, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { SETTINGS_DIVIDER, SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export type AccountSyncState = "active" | "error" | "reauth_required" | "paused" | "disabled";
export type AccountCapabilityId = "mail" | "calendar";

/** One sync channel (mail or calendar) of an account: its state, a summary and, while importing, a progress bar. */
export interface AccountSyncLine {
  kind: AccountCapabilityId;
  state: AccountSyncState;
  /** e.g. "last checked 5m ago · history imported (1,204 messages)". */
  summary: string;
  progress?: { value: number; label: string; paused?: boolean };
  /** Shows a pause / resume button next to the progress bar. */
  canTogglePause?: boolean;
  error?: string | null;
}

export interface SettingsAccount {
  id: string;
  name: string;
  initials: string;
  /** "Google", "iCloud", "IMAP / CalDAV", … */
  provider: string;
  shared?: boolean;
  /** Shown for accounts you don't own, e.g. "editor". */
  role?: string | null;
  /** Whether you own it — owners get the capability switches and full menu. */
  owner: boolean;
  mail: boolean;
  calendar: boolean;
  lines: AccountSyncLine[];
  needsReconnect?: boolean;
  /** "Google" / "Microsoft" adds a "Reconnect …" menu item; null for IMAP accounts. */
  reconnectLabel?: string | null;
  /** Result of the last "Test connection". */
  testResult?: string | null;
}

export interface SettingsAccountsProps extends ComponentProps<typeof SettingsCard> {
  accounts: SettingsAccount[];
  loading?: boolean;
  /** Text under the header. */
  note?: string;
  onAdd?: () => void;
  onToggleCapability: (id: string, capability: AccountCapabilityId, on: boolean) => void;
  onSync: (id: string) => void;
  onTest: (id: string) => void;
  onEdit: (id: string) => void;
  onShare: (id: string) => void;
  onReconnect: (id: string) => void;
  onImport: (id: string) => void;
  onRemove: (id: string) => void;
  onTogglePause: (id: string, paused: boolean) => void;
  /** Extra content under the list — errors, import results. */
  footer?: React.ReactNode;
}

const PILL = "rounded-md px-1.5 py-px text-xs leading-5";

const STATE_PILL: Record<AccountSyncState, { label: string; className: string }> = {
  active: { label: "Syncing", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" },
  error: { label: "Error", className: "bg-destructive/10 text-destructive" },
  reauth_required: { label: "Reconnect needed", className: "bg-amber-500/10 text-amber-600 dark:text-amber-500" },
  paused: { label: "Paused", className: "bg-foreground/6 text-muted-foreground" },
  disabled: { label: "Off", className: "bg-foreground/6 text-muted-foreground" },
};

function SyncLine({ line, onTogglePause }: { line: AccountSyncLine; onTogglePause: (paused: boolean) => void }) {
  const Icon = line.kind === "mail" ? Mail : Calendar;
  const pill = STATE_PILL[line.state] ?? STATE_PILL.active;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-muted-foreground capitalize">{line.kind}</span>
        <span className={cn(PILL, pill.className)}>{pill.label}</span>
        <span className="min-w-0 truncate">{line.summary}</span>
      </div>
      {line.progress ? (
        <div className="flex items-center gap-2">
          <Progress value={line.progress.value} className="h-1.5 flex-1" />
          <span className="text-muted-foreground/70 shrink-0 text-xs tabular-nums">{line.progress.label}</span>
          {line.canTogglePause ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={line.progress.paused ? "Resume history import" : "Pause history import"}
              onClick={() => onTogglePause(!line.progress?.paused)}
            >
              {line.progress.paused ? <Play /> : <Pause />}
            </Button>
          ) : null}
        </div>
      ) : null}
      {line.error ? <p className="text-destructive text-xs break-words">{line.error}</p> : null}
    </div>
  );
}

/** Connected mail / calendar logins: one row per account with its capability switches, sync status and an actions menu. Controlled. */
export function SettingsAccounts({
  accounts,
  loading,
  note,
  onAdd,
  onToggleCapability,
  onSync,
  onTest,
  onEdit,
  onShare,
  onReconnect,
  onImport,
  onRemove,
  onTogglePause,
  footer,
  className,
  ...props
}: SettingsAccountsProps) {
  return (
    <SettingsCard data-slot="settings-accounts" className={className} {...props}>
      <SettingsCardHeader icon={AtSign} title="Connected accounts">
        <span className="text-muted-foreground/70 text-[13px] tabular-nums">{accounts.length} connected</span>
        {onAdd ? (
          <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
            <Plus data-icon="inline-start" /> Add
          </Button>
        ) : null}
      </SettingsCardHeader>

      {note ? (
        <SettingsCardRow divider className="py-3">
          <p className="text-muted-foreground/70 text-xs">{note}</p>
        </SettingsCardRow>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No accounts connected yet.</p>
      ) : (
        <ul>
          {accounts.map((account) => (
            <li key={account.id} className={cn("relative flex flex-col gap-3 px-5 py-4 last:after:hidden", SETTINGS_DIVIDER)}>
              <div className="flex items-center gap-3">
                <span
                  className="bg-foreground/6 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  aria-hidden="true"
                >
                  {account.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-foreground min-w-0 truncate text-sm font-medium">{account.name}</span>
                    <span className={cn(PILL, "bg-foreground/6 text-muted-foreground")}>{account.provider}</span>
                    {account.shared ? (
                      <span className={cn(PILL, "bg-foreground/6 text-muted-foreground flex items-center gap-1")}>
                        <Users className="size-3" aria-hidden="true" /> shared
                      </span>
                    ) : null}
                    {account.role ? <span className={cn(PILL, "bg-foreground/6 text-muted-foreground")}>{account.role}</span> : null}
                  </div>
                  {account.testResult ? <p className="text-muted-foreground/70 text-xs">{account.testResult}</p> : null}
                </div>

                {account.owner ? (
                  <div className="flex items-center gap-4">
                    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Mail className="size-3.5" aria-hidden="true" /> Mail
                      <Switch
                        checked={account.mail}
                        disabled={account.mail && !account.calendar}
                        onCheckedChange={(on) => onToggleCapability(account.id, "mail", on)}
                      />
                    </label>
                    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Calendar className="size-3.5" aria-hidden="true" /> Calendar
                      <Switch
                        checked={account.calendar}
                        disabled={account.calendar && !account.mail}
                        onCheckedChange={(on) => onToggleCapability(account.id, "calendar", on)}
                      />
                    </label>
                  </div>
                ) : null}

                {account.needsReconnect && account.owner ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => onReconnect(account.id)}>
                    <Zap data-icon="inline-start" /> Reconnect
                  </Button>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${account.name}`}
                      className="text-muted-foreground hover:text-foreground rounded-full"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onSync(account.id)}>
                      <RefreshCw /> Sync now
                    </DropdownMenuItem>
                    {account.owner ? (
                      <>
                        <DropdownMenuItem onSelect={() => onTest(account.id)}>
                          <Zap /> Test connection
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onEdit(account.id)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onShare(account.id)}>
                          <Share2 /> Sharing
                        </DropdownMenuItem>
                        {account.reconnectLabel ? (
                          <DropdownMenuItem onSelect={() => onReconnect(account.id)}>
                            <KeyRound /> Reconnect {account.reconnectLabel}
                          </DropdownMenuItem>
                        ) : null}
                        {account.mail ? (
                          <DropdownMenuItem onSelect={() => onImport(account.id)}>
                            <Upload /> Import .eml files
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onRemove(account.id)}>
                          <Trash2 /> Remove account
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onSelect={() => onShare(account.id)}>
                        <Users /> Members
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {account.lines.length > 0 ? (
                <div className="flex flex-col gap-2.5 pl-11">
                  {account.lines.map((line) => (
                    <SyncLine key={line.kind} line={line} onTogglePause={(paused) => onTogglePause(account.id, paused)} />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {footer ? <div className="flex flex-col gap-1 px-5 pb-4">{footer}</div> : null}
    </SettingsCard>
  );
}
