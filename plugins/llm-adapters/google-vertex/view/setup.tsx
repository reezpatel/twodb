import { useState } from "react";
import { Input, Textarea } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { GoogleVertexConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): GoogleVertexConnectionConfig {
  const stored = (raw ?? {}) as Partial<GoogleVertexConnectionConfig>;
  return {
    project: stored.project ?? "",
    location: stored.location ?? "",
    service_account_json: stored.service_account_json ?? "",
  };
}

export function GoogleVertexSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<GoogleVertexConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof GoogleVertexConnectionConfig, value: string) => {
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
          Project
          <Input defaultValue={current.project} placeholder="my-gcp-project" onBlur={(event) => field("project", event.target.value.trim())} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)", flex: 1 }}>
          Location
          <Input defaultValue={current.location} placeholder="us-central1" onBlur={(event) => field("location", event.target.value.trim())} />
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Service account JSON
        <Textarea
          rows={6}
          defaultValue={current.service_account_json}
          placeholder='{ "type": "service_account", "project_id": "…", "client_email": "…", "private_key": "…" }'
          spellCheck={false}
          onBlur={(event) => field("service_account_json", event.target.value.trim())}
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
