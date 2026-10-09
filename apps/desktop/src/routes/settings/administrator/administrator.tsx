import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, KeyRound, Loader2, Plus, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePwaInstall } from "./use-pwa-install";

interface ServerSettings {
  signUpEnabled: boolean;
}

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

export function AdministratorSection() {
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["server-settings"],
    queryFn: () => api<ServerSettings>("/api/server-settings"),
  });

  const update = useMutation({
    mutationFn: (signUpEnabled: boolean) => api<ServerSettings>("/api/server-settings", { method: "PUT", body: JSON.stringify({ signUpEnabled }) }),
    onSuccess: (row) => void queryClient.setQueryData(["server-settings"], row),
  });

  const signUpEnabled = settings.data?.signUpEnabled ?? true;

  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<ApiKeyRow[]>("/api/api-keys"),
  });
  const [keyName, setKeyName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createKey = useMutation({
    mutationFn: (name: string) => api<ApiKeyRow & { key: string }>("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (row) => {
      setKeyName("");
      setRevealed(row.key);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const pwa = usePwaInstall();

  const copyRevealed = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={16} aria-hidden="true" /> Administrator
          </CardTitle>
          <CardDescription>instance-wide settings — applies to every organization</CardDescription>
        </CardHeader>
        <CardContent>
          {settings.isError ? (
            <p className="text-destructive text-sm">Not available — requires an admin account.</p>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="sign-up-toggle">Allow new sign-ups</Label>
                <p className="text-muted-foreground text-xs">When off, the register page is closed and /sign-up/email returns 403.</p>
              </div>
              <Switch
                id="sign-up-toggle"
                checked={signUpEnabled}
                disabled={settings.isPending || update.isPending}
                onCheckedChange={(checked) => update.mutate(checked)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound size={16} aria-hidden="true" /> API keys
          </CardTitle>
          <CardDescription>org-scoped keys for programmatic access — send as x-api-key header</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input className="h-8 flex-1" placeholder="Key name (e.g. ci-runner)" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <Button size="sm" disabled={!keyName.trim() || createKey.isPending} onClick={() => createKey.mutate(keyName.trim())}>
              {createKey.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Generate
            </Button>
          </div>

          {revealed && (
            <div className="bg-muted space-y-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Copy this key now — it is never shown again.</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs break-all">{revealed}</code>
                <Button variant="outline" size="icon-sm" title="Copy" onClick={() => void copyRevealed()}>
                  {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {keys.isError ? (
            <p className="text-muted-foreground text-sm">Sign in to manage API keys.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(keys.data ?? []).map((k) => (
                <li key={k.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{k.name}</span>
                      {k.revokedAt ? (
                        <span className="text-destructive text-[10px] font-semibold uppercase">revoked</span>
                      ) : (
                        <code className="text-muted-foreground font-mono text-xs">{k.prefix}…</code>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      created {relativeTime(k.createdAt)} · last used {relativeTime(k.lastUsedAt)}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={revokeKey.isPending}
                      onClick={() => revokeKey.mutate(k.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
              {(keys.data ?? []).length === 0 && !keys.isPending && <p className="text-muted-foreground px-1 text-xs">No keys yet — generate one above.</p>}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download size={16} aria-hidden="true" /> Install app
          </CardTitle>
          <CardDescription>install twodb as a standalone desktop-style app</CardDescription>
        </CardHeader>
        <CardContent>
          {pwa.state === "standalone" ? (
            <p className="text-sm">Installed — you are running the app version.</p>
          ) : pwa.canInstall ? (
            <Button size="sm" onClick={() => void pwa.install()}>
              <Download size={13} /> Install
            </Button>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Your browser has not offered installation yet. It needs HTTPS, a service worker, and a moment of usage first.
              </p>
              <p className="text-muted-foreground text-xs">
                Chrome/Edge: ⋮ menu → Cast, save and share → Install page as app. Safari: Share → Add to Dock. Firefox: address-bar
                install icon.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
