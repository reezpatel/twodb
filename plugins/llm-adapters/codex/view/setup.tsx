import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { CodexConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): CodexConnectionConfig {
  const stored = (raw ?? {}) as Partial<CodexConnectionConfig>;
  return {
    refresh_token: stored.refresh_token ?? "",
    account_id: stored.account_id ?? "",
  };
}

export function CodexSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<CodexConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof CodexConnectionConfig, value: string) => {
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
          placeholder="~/.codex/auth.json → tokens.refresh_token"
          onBlur={(event) => field("refresh_token", event.target.value.trim())}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        ChatGPT Account ID (optional)
        <Input
          type="text"
          defaultValue={current.account_id}
          placeholder="optional"
          onBlur={(event) => field("account_id", event.target.value.trim())}
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
