import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { AzureOpenAiConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): AzureOpenAiConnectionConfig {
  const stored = (raw ?? {}) as Partial<AzureOpenAiConnectionConfig>;
  return {
    api_key: stored.api_key ?? "",
    base_url: stored.base_url ?? "",
    api_version: stored.api_version ?? "2025-04-01-preview",
    deployment_map: stored.deployment_map ?? "",
  };
}

export function AzureOpenAiSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<AzureOpenAiConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof AzureOpenAiConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 2 }}>
          Base URL
          <Input
            type="text"
            defaultValue={current.base_url}
            placeholder="https://<resource>.openai.azure.com"
            onBlur={(event) => field("base_url", event.target.value.trim())}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          API key
          <Input type="password" defaultValue={current.api_key} placeholder="Azure key" onBlur={(event) => field("api_key", event.target.value.trim())} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          API version
          <Input
            type="text"
            defaultValue={current.api_version}
            placeholder="2025-04-01-preview"
            onBlur={(event) => field("api_version", event.target.value.trim())}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 2 }}>
          Deployment map
          <Input
            type="text"
            defaultValue={current.deployment_map}
            placeholder="gpt-4o-mini=my-deployment,gpt-4o=prod"
            onBlur={(event) => field("deployment_map", event.target.value.trim())}
          />
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
