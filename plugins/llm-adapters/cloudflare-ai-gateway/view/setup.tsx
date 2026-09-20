import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { CloudflareAiGatewayConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): CloudflareAiGatewayConnectionConfig {
  const stored = (raw ?? {}) as Partial<CloudflareAiGatewayConnectionConfig>;
  return {
    account_id: stored.account_id ?? "",
    gateway_id: stored.gateway_id ?? "",
    api_key: stored.api_key ?? "",
  };
}

export function CloudflareAiGatewaySetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<CloudflareAiGatewayConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof CloudflareAiGatewayConnectionConfig, value: string) => {
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
          Account ID
          <Input
            type="text"
            defaultValue={current.account_id}
            placeholder="Cloudflare account id"
            onBlur={(event) => field("account_id", event.target.value.trim())}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Gateway ID
          <Input type="text" defaultValue={current.gateway_id} placeholder="Gateway id" onBlur={(event) => field("gateway_id", event.target.value.trim())} />
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        API key (optional)
        <Input
          type="password"
          defaultValue={current.api_key}
          placeholder="Upstream provider key forwarded by the gateway"
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
