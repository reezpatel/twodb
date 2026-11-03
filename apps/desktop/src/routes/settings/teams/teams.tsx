import { useState } from "react";
import { SettingsTeams } from "@/components/blocks/settings/teams/settings-teams";
import { useRunners } from "../runners/use-runners";
import { useTeamsAccounts, type TeamsAccount } from "./use-teams";
import { TeamsLiveView } from "./teams-live-view";

/** Settings → Teams: watched Teams accounts, their runner binding, and the
 *  connect screen (live view) for interactive sign-in. */
export function TeamsSection() {
  const { accounts, create, update, remove, start, stop } = useTeamsAccounts();
  const { runners } = useRunners();
  const [liveAccount, setLiveAccount] = useState<TeamsAccount | null>(null);

  if (liveAccount) {
    const fresh = accounts.data?.find((a) => a.id === liveAccount.id) ?? liveAccount;
    return <TeamsLiveView account={fresh} onClose={() => setLiveAccount(null)} />;
  }

  const runnerList = runners.data ?? [];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsTeams
        accounts={(accounts.data ?? []).map((a) => ({
          id: a.id,
          label: a.label,
          status: a.status,
          enabled: a.enabled,
          runnerName: runnerList.find((r) => r.id === a.runnerId)?.name ?? "unknown runner",
          runnerOnline: a.runnerOnline,
          email: a.email,
          lastEventLabel: a.lastEventAt ? new Date(a.lastEventAt).toLocaleString() : null,
          lastError: a.lastError,
        }))}
        runners={runnerList.map((r) => ({ id: r.id, name: r.name, online: r.online }))}
        loading={accounts.isPending}
        onCreate={(input) => create.mutate(input)}
        creating={create.isPending}
        createError={create.isError ? "Failed to add the account — is the runner valid?" : null}
        onToggleEnabled={(id, enabled) => update.mutate({ id, enabled })}
        onConnect={(id) => setLiveAccount(accounts.data?.find((a) => a.id === id) ?? null)}
        onStart={(id) => start.mutate(id)}
        onStop={(id) => stop.mutate(id)}
        onRemove={(id) => remove.mutate(id)}
      />
    </div>
  );
}
