import { useState, type ComponentProps } from "react";
import { Loader2, MonitorUp, Play, Plus, Square, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SETTINGS_DIVIDER, SettingsCard, SettingsCardHeader, SettingsCardRow } from "../settings-card";

export type TeamsStatus = "running" | "starting" | "idle" | "auth_required" | "error" | "runner_offline" | (string & {});

export interface TeamsAccountItem {
  id: string;
  label: string;
  status: TeamsStatus;
  enabled: boolean;
  /** Name of the runner hosting the browser. */
  runnerName: string;
  runnerOnline: boolean;
  email?: string | null;
  /** Pre-formatted, e.g. "5/14/2025, 9:12 AM". */
  lastEventLabel?: string | null;
  lastError?: string | null;
}

export interface TeamsRunnerOption {
  id: string;
  name: string;
  online: boolean;
}

export interface NewTeamsAccount {
  label: string;
  runnerId: string;
  email?: string;
}

export interface SettingsTeamsProps extends ComponentProps<typeof SettingsCard> {
  accounts: TeamsAccountItem[];
  runners: TeamsRunnerOption[];
  loading?: boolean;
  onCreate: (account: NewTeamsAccount) => void;
  creating?: boolean;
  createError?: string | null;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  /** Opens the live browser screen for interactive sign-in. */
  onConnect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  running: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500",
  starting: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  auth_required: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  error: "bg-destructive/10 text-destructive",
};

/** Watched Microsoft Teams accounts: each runs a Chromium session on a runner and forwards messages and calls to notifications. Controlled. */
export function SettingsTeams({
  accounts,
  runners,
  loading,
  onCreate,
  creating,
  createError,
  onToggleEnabled,
  onConnect,
  onStart,
  onStop,
  onRemove,
  className,
  ...props
}: SettingsTeamsProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [runnerId, setRunnerId] = useState("");

  return (
    <SettingsCard data-slot="settings-teams" className={className} {...props}>
      <SettingsCardHeader icon={Users} title="Teams accounts">
        <span className="text-muted-foreground/70 text-[13px] tabular-nums">{accounts.length} connected</span>
        <Button type="button" size="sm" variant="secondary" aria-expanded={adding} onClick={() => setAdding((open) => !open)}>
          <Plus data-icon="inline-start" /> Add
        </Button>
      </SettingsCardHeader>

      <SettingsCardRow divider className="py-3">
        <p className="text-muted-foreground/70 text-xs">
          Each account runs a persistent Chromium session on its runner and forwards incoming messages and calls to your notifications. Read-only — you reply
          inside Teams itself.
        </p>
      </SettingsCardRow>

      {adding ? (
        <SettingsCardRow divider className="bg-foreground/4 py-3">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!label.trim() || !runnerId) return;
              onCreate({ label: label.trim(), runnerId, email: email.trim() || undefined });
              setLabel("");
              setEmail("");
              setAdding(false);
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="Company label (e.g. Acme Corp)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                aria-label="Company label"
              />
              <Input
                className="h-8 text-sm"
                placeholder="Login email (hint, optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Login email"
              />
            </div>
            <div className="flex gap-2">
              <Select value={runnerId} onValueChange={setRunnerId}>
                <SelectTrigger className="flex-1" aria-label="Runner">
                  <SelectValue placeholder="Runner that hosts the browser" />
                </SelectTrigger>
                <SelectContent>
                  {runners.map((runner) => (
                    <SelectItem key={runner.id} value={runner.id}>
                      {runner.name} {runner.online ? "(online)" : "(offline)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="secondary" disabled={creating || !label.trim() || !runnerId}>
                {creating ? <Loader2 className="animate-spin" /> : null} Add account
              </Button>
            </div>
          </form>
        </SettingsCardRow>
      ) : null}

      {createError ? (
        <p className="text-destructive px-5 py-3 text-xs" role="alert">
          {createError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm">No Teams accounts yet. Add one per company you work with.</p>
      ) : (
        <ul>
          {accounts.map((account) => (
            <li key={account.id} className={cn("relative flex flex-col gap-2 px-5 py-4 last:after:hidden", SETTINGS_DIVIDER)}>
              <div className="flex items-center gap-2">
                <span className="text-foreground min-w-0 truncate text-sm font-medium">{account.label}</span>
                <span className={cn("bg-foreground/6 text-muted-foreground rounded-md px-1.5 py-px text-xs leading-5", STATUS_STYLE[account.status])}>
                  {account.status.replace(/_/g, " ")}
                </span>
                {account.status === "starting" ? <Loader2 className="text-muted-foreground size-3.5 animate-spin" aria-hidden="true" /> : null}

                <div className="ml-auto flex items-center gap-1">
                  <Switch
                    checked={account.enabled}
                    onCheckedChange={(enabled) => onToggleEnabled(account.id, enabled)}
                    aria-label={`Enable ${account.label}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onConnect(account.id)}
                    disabled={!account.runnerOnline}
                    title="Open the browser screen"
                  >
                    <MonitorUp data-icon="inline-start" /> Connect
                  </Button>
                  {account.enabled ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onStop(account.id)}
                      title="Stop watching"
                      aria-label={`Stop watching ${account.label}`}
                    >
                      <Square />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onStart(account.id)}
                      title="Start watching"
                      aria-label={`Start watching ${account.label}`}
                    >
                      <Play />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(account.id)}
                    title="Remove account"
                    aria-label={`Remove ${account.label}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <p className="text-muted-foreground/70 flex flex-wrap gap-x-3 text-xs">
                <span>
                  {account.runnerName}
                  {account.runnerOnline ? "" : " (offline)"}
                </span>
                {account.email ? <span>{account.email}</span> : null}
                {account.lastEventLabel ? <span>last event {account.lastEventLabel}</span> : null}
              </p>

              {account.status === "auth_required" ? (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Sign-in required — open Connect and complete the login (incl. 2FA) in the browser screen.
                </p>
              ) : null}
              {account.lastError && account.status === "error" ? (
                <p className="text-destructive text-xs" role="alert">
                  {account.lastError}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
