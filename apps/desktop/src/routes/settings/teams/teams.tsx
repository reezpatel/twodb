import { useState } from "react";
import { Loader2, MonitorUp, Play, Square, Trash2 } from "lucide-react";
import { useRunners } from "../runners/use-runners";
import { useTeamsAccounts, type TeamsAccount } from "./use-teams";
import { TeamsLiveView } from "./teams-live-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "default",
  starting: "secondary",
  idle: "outline",
  auth_required: "destructive",
  error: "destructive",
  runner_offline: "outline",
};

/** Settings → Teams: watched Teams accounts, their runner binding, and the
 *  connect screen (live view) for interactive sign-in. */
export function TeamsSection() {
  const { accounts, create, update, remove, start, stop } = useTeamsAccounts();
  const { runners } = useRunners();
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [runnerId, setRunnerId] = useState("");
  const [liveAccount, setLiveAccount] = useState<TeamsAccount | null>(null);

  if (liveAccount) {
    const fresh = accounts.data?.find((a) => a.id === liveAccount.id) ?? liveAccount;
    return <TeamsLiveView account={fresh} onClose={() => setLiveAccount(null)} />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Teams accounts</CardTitle>
          <CardDescription>
            Each account runs a persistent Chromium session on its runner and forwards incoming messages and calls to your notifications. Read-only — you
            reply inside Teams itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!label.trim() || !runnerId) return;
              create.mutate({ label: label.trim(), runnerId, email: email.trim() || undefined });
              setLabel("");
              setEmail("");
            }}
          >
            <div className="flex gap-2">
              <Input className="grow" placeholder="Company label (e.g. Acme Corp)" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input className="grow" placeholder="Login email (hint, optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={runnerId} onValueChange={setRunnerId}>
                <SelectTrigger className="grow">
                  <SelectValue placeholder="Runner that hosts the browser" />
                </SelectTrigger>
                <SelectContent>
                  {(runners.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} {r.online ? "(online)" : "(offline)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={create.isPending || !label.trim() || !runnerId}>
                {create.isPending ? <Loader2 className="animate-spin" /> : "Add account"}
              </Button>
            </div>
            {create.isError && (
              <p className="text-destructive text-sm" role="alert">
                Failed to add the account — is the runner valid?
              </p>
            )}
          </form>

          {accounts.data?.length === 0 && <p className="text-muted-foreground text-sm">No Teams accounts yet. Add one per company you work with.</p>}

          <ul className="flex flex-col gap-2">
            {(accounts.data ?? []).map((account) => (
              <li key={account.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{account.label}</span>
                  <Badge variant={STATUS_VARIANT[account.status] ?? "outline"}>{account.status.replace("_", " ")}</Badge>
                  {account.status === "starting" && <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />}
                  <div className="ml-auto flex items-center gap-1">
                    <Switch checked={account.enabled} onCheckedChange={(enabled) => update.mutate({ id: account.id, enabled })} aria-label="Enabled" />
                    <Button variant="ghost" size="sm" onClick={() => setLiveAccount(account)} disabled={!account.runnerOnline} title="Open the browser screen">
                      <MonitorUp />
                      Connect
                    </Button>
                    {account.enabled ? (
                      <Button variant="ghost" size="sm" onClick={() => stop.mutate(account.id)} title="Stop watching">
                        <Square />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => start.mutate(account.id)} title="Start watching">
                        <Play />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => remove.mutate(account.id)} title="Remove account">
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="text-muted-foreground flex gap-3 text-xs">
                  <span>{runners.data?.find((r) => r.id === account.runnerId)?.name ?? "unknown runner"}</span>
                  {account.email && <span>{account.email}</span>}
                  {account.lastEventAt && <span>last event {new Date(account.lastEventAt).toLocaleString()}</span>}
                </div>
                {account.status === "auth_required" && (
                  <p className="text-sm text-yellow-500">Sign-in required — open Connect and complete the login (incl. 2FA) in the browser screen.</p>
                )}
                {account.lastError && account.status === "error" && (
                  <p className="text-destructive text-sm" role="alert">
                    {account.lastError}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
