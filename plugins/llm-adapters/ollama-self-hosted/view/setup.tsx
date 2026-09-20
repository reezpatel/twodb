import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { OllamaSelfHostedConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): OllamaSelfHostedConnectionConfig {
  const stored = (raw ?? {}) as Partial<OllamaSelfHostedConnectionConfig>;
  return {
    base_url: stored.base_url ?? "http://localhost:11434",
  };
}

export function OllamaSelfHostedSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<OllamaSelfHostedConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof OllamaSelfHostedConnectionConfig, value: string) => {
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
          placeholder="http://localhost:11434"
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
