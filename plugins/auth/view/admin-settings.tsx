import { useState } from "react";
import { Input, Switch } from "@twodb/ui";
import type { AuthPluginConfig } from "../shared/api";

const defaults: AuthPluginConfig = {
  passkeys: { enabled: true },
  googleSso: { enabled: false, clientId: "", clientSecret: "" },
  magicLink: { enabled: false },
};

function mergeConfig(raw: unknown): AuthPluginConfig {
  const stored = (raw ?? {}) as Partial<AuthPluginConfig>;
  return {
    passkeys: { enabled: stored.passkeys?.enabled ?? defaults.passkeys.enabled },
    googleSso: {
      enabled: stored.googleSso?.enabled ?? false,
      clientId: stored.googleSso?.clientId ?? "",
      clientSecret: stored.googleSso?.clientSecret ?? "",
    },
    magicLink: { enabled: stored.magicLink?.enabled ?? false },
  };
}

export function AdminSettings({ config, setConfig }: { config: unknown; setConfig: (data: unknown) => Promise<{ success: boolean; errors?: string[] }> }) {
  const [current, setCurrent] = useState<AuthPluginConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = async (next: AuthPluginConfig) => {
    setStatus("saving");
    const result = await setConfig(next);
    setStatus(result.success ? "saved" : "error");
  };

  const toggle = (key: "passkeys" | "googleSso" | "magicLink", enabled: boolean) => {
    const next = { ...current, [key]: { ...current[key], enabled } };
    setCurrent(next);
    if (!enabled || key !== "googleSso" || current.googleSso.clientId) void save(next);
  };

  const field = (key: "clientId" | "clientSecret", value: string) => {
    if (value === current.googleSso[key]) return;
    const next = { ...current, googleSso: { ...current.googleSso, [key]: value } };
    setCurrent(next);
    void save(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Switch label="Passkeys" checked={current.passkeys.enabled} onChange={(event) => toggle("passkeys", event.target.checked)} />
      <Switch label="Google SSO" checked={current.googleSso.enabled} onChange={(event) => toggle("googleSso", event.target.checked)} />
      {current.googleSso.enabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--ink-3)" }}>
            Client ID
            <Input
              defaultValue={current.googleSso.clientId}
              placeholder="xxx.apps.googleusercontent.com"
              onBlur={(event) => field("clientId", event.target.value.trim())}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, color: "var(--ink-3)" }}>
            Client secret
            <Input type="password" defaultValue={current.googleSso.clientSecret} onBlur={(event) => field("clientSecret", event.target.value.trim())} />
          </label>
        </div>
      ) : null}
      <Switch label="Magic link" checked={current.magicLink.enabled} onChange={(event) => toggle("magicLink", event.target.checked)} />
      <p style={{ margin: 0, minHeight: 18, fontSize: 12.5, color: status === "error" ? "var(--danger-ink, #9d1b4f)" : "var(--ink-3)" }}>
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Could not save — try again" : ""}
      </p>
    </div>
  );
}
