import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { OpenAiConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): OpenAiConnectionConfig {
  const stored = (raw ?? {}) as Partial<OpenAiConnectionConfig>;
  return {
    api_key: stored.api_key ?? "",
    base_url: stored.base_url ?? "",
    org: stored.org ?? "",
  };
}

export function OpenAiSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<OpenAiConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof OpenAiConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        API key
        <Input type="password" defaultValue={current.api_key} placeholder="sk-…" onBlur={(event) => field("api_key", event.target.value.trim())} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Base URL (optional)
          <Input defaultValue={current.base_url} placeholder="https://api.openai.com/v1" onBlur={(event) => field("base_url", event.target.value.trim())} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Organization (optional)
          <Input defaultValue={current.org} placeholder="org-…" onBlur={(event) => field("org", event.target.value.trim())} />
        </label>
      </div>
      {status !== "idle" && status !== "saved" ? (
        <span style={{ fontSize: "var(--text-sm)", color: status === "error" ? "var(--danger)" : "var(--ink-3)" }}>
          {status === "saving" ? "Saving…" : "Save failed"}
        </span>
      ) : null}
    </div>
  );
}
