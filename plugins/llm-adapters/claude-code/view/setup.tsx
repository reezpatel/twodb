import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { ClaudeCodeConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): ClaudeCodeConnectionConfig {
  const stored = (raw ?? {}) as Partial<ClaudeCodeConnectionConfig>;
  return {
    refresh_token: stored.refresh_token ?? "",
    access_token: stored.access_token ?? "",
  };
}

export function ClaudeCodeSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<ClaudeCodeConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof ClaudeCodeConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        OAuth Refresh Token
        <Input
          type="password"
          defaultValue={current.refresh_token}
          placeholder="~/.claude/.credentials.json → refreshToken"
          onBlur={(event) => field("refresh_token", event.target.value.trim())}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        OAuth Access Token
        <Input
          type="password"
          defaultValue={current.access_token}
          placeholder="~/.claude/.credentials.json → accessToken"
          onBlur={(event) => field("access_token", event.target.value.trim())}
        />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>auto-refreshed by hand for now — refresh flow not implemented</span>
      </label>
      {status !== "idle" && status !== "saved" ? (
        <span style={{ fontSize: "var(--text-sm)", color: status === "error" ? "var(--danger)" : "var(--ink-3)" }}>
          {status === "saving" ? "Saving…" : "Save failed"}
        </span>
      ) : null}
    </div>
  );
}
