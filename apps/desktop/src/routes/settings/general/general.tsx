import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SettingsAppearance } from "@/components/blocks/settings/general/settings-appearance";
import { SettingsApiKeys, type SettingsApiKey } from "@/components/blocks/settings/general/settings-api-keys";
import { useTheme } from "@/lib/theme";
import { usePwaInstall } from "./use-pwa-install";
import { useRunnerKeys } from "./use-runner-keys";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function relativeTime(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export function GeneralSection() {
  const { preference, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const pwa = usePwaInstall();
  const runnerKeys = useRunnerKeys();

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => api<ApiKeyRow[]>("/api/api-keys") });
  const [newKey, setNewKey] = useState<string | null>(null);

  const createKey = useMutation({
    mutationFn: (name: string) => api<ApiKeyRow & { key: string }>("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (row) => {
      setNewKey(row.key);
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const items: SettingsApiKey[] = (keys.data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdLabel: relativeTime(k.createdAt),
    lastUsedLabel: relativeTime(k.lastUsedAt),
    revoked: !!k.revokedAt,
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsAppearance theme={preference} onThemeChange={setTheme} installState={pwa.state} onInstall={() => void pwa.install()} />
      <SettingsApiKeys
        title="Runner access keys"
        keys={(runnerKeys.keys.data ?? []).map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdLabel: relativeTime(k.createdAt),
          lastUsedLabel: "never",
          revoked: !!k.revokedAt,
        }))}
        loading={runnerKeys.keys.isPending}
        error={runnerKeys.keys.isError ? "Couldn't load runner keys." : null}
        onCreate={(name) => runnerKeys.createKey.mutate(name)}
        creating={runnerKeys.createKey.isPending}
        newKey={runnerKeys.newKey}
        onDismissNewKey={() => runnerKeys.setNewKey(null)}
        onRevoke={(id) => runnerKeys.revokeKey.mutate(id)}
        revoking={runnerKeys.revokeKey.isPending}
      />
      <SettingsApiKeys
        keys={items}
        loading={keys.isPending}
        error={keys.isError ? "Sign in to manage API keys." : null}
        onCreate={(name) => createKey.mutate(name)}
        creating={createKey.isPending}
        newKey={newKey}
        onDismissNewKey={() => setNewKey(null)}
        onRevoke={(id) => revokeKey.mutate(id)}
        revoking={revokeKey.isPending}
      />
    </div>
  );
}
