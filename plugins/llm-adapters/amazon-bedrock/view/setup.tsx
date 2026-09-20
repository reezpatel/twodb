import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { BedrockConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): BedrockConnectionConfig {
  const stored = (raw ?? {}) as Partial<BedrockConnectionConfig>;
  return {
    region: stored.region ?? "",
    access_key_id: stored.access_key_id ?? "",
    secret_access_key: stored.secret_access_key ?? "",
    session_token: stored.session_token ?? "",
  };
}

export function BedrockSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<BedrockConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof BedrockConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Region
          <Input defaultValue={current.region} placeholder="us-east-1" onBlur={(event) => field("region", event.target.value.trim())} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Session token (optional)
          <Input
            type="password"
            defaultValue={current.session_token}
            placeholder="for temporary credentials"
            onBlur={(event) => field("session_token", event.target.value.trim())}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Access key ID
          <Input
            type="password"
            defaultValue={current.access_key_id}
            placeholder="AKIA…"
            onBlur={(event) => field("access_key_id", event.target.value.trim())}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Secret access key
          <Input
            type="password"
            defaultValue={current.secret_access_key}
            placeholder="IAM secret"
            onBlur={(event) => field("secret_access_key", event.target.value.trim())}
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
