import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { AnthropicConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): AnthropicConnectionConfig {
  const stored = (raw ?? {}) as Partial<AnthropicConnectionConfig>;
  return {
    api_key: stored.api_key ?? "",
    base_url: stored.base_url ?? "",
  };
}

export function AnthropicSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<AnthropicConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof AnthropicConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        API Key
        <Input type="password" defaultValue={current.api_key} placeholder="sk-ant-…" onBlur={(event) => field("api_key", event.target.value.trim())} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Base URL (optional)
        <Input
          type="text"
          defaultValue={current.base_url}
          placeholder="https://api.anthropic.com"
          onBlur={(event) => field("base_url", event.target.value.trim())}
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
