import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { OpenaiCompatibleConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): OpenaiCompatibleConnectionConfig {
  const stored = (raw ?? {}) as Partial<OpenaiCompatibleConnectionConfig>;
  return {
    base_url: stored.base_url ?? "",
    api_key: stored.api_key ?? "",
  };
}

export function OpenaiCompatibleSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<OpenaiCompatibleConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof OpenaiCompatibleConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Base URL
        <Input
          type="text"
          defaultValue={current.base_url}
          placeholder="http://localhost:11434/v1"
          onBlur={(event) => field("base_url", event.target.value.trim())}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        API Key (optional)
        <Input
          type="password"
          defaultValue={current.api_key}
          placeholder="optional — local servers often need none"
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
