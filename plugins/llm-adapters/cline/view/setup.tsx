import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { ClineConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): ClineConnectionConfig {
  const stored = (raw ?? {}) as Partial<ClineConnectionConfig>;
  return {
    refresh_token: stored.refresh_token ?? "",
    access_token: stored.access_token ?? "",
    expires_at: stored.expires_at ?? "",
    api_key: stored.api_key ?? "",
  };
}

export function ClineSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<ClineConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof ClineConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Session Refresh Token
        <Input
          type="password"
          defaultValue={current.refresh_token}
          placeholder="api.cline.bot session"
          onBlur={(event) => field("refresh_token", event.target.value.trim())}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Session Access Token (optional)
        <Input
          type="password"
          defaultValue={current.access_token}
          placeholder="used for balance monitoring — auto-refresh is not available here"
          onBlur={(event) => field("access_token", event.target.value.trim())}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Access Token Expiry (optional)
        <Input
          defaultValue={current.expires_at}
          placeholder="ms epoch — skips a usage fetch while the token is valid"
          onBlur={(event) => field("expires_at", event.target.value.trim())}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        API Key (optional)
        <Input
          type="password"
          defaultValue={current.api_key}
          placeholder="optional — API-key based access"
          onBlur={(event) => field("api_key", event.target.value.trim())}
        />
      </label>
      {status !== "idle" && status !== "saved" ? (
        <span style={{ fontSize: "var(--text-sm)", color: status === "error" ? "var(--danger)" : "var(--ink-3)" }}>
          {status === "saving" ? "Saving…" : "Save failed"}
        </span>
      ) : null}
    </div>
  );
}
