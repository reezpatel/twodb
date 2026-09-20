import { useState } from "react";
import { Input } from "@twodb/ui";
import type { LlmProviderSetupProps } from "@twodb/shared-frontend";
import type { KiloCodeConnectionConfig } from "../shared/api";

function mergeConfig(raw: unknown): KiloCodeConnectionConfig {
  const stored = (raw ?? {}) as Partial<KiloCodeConnectionConfig>;
  return {
    session_cookie: stored.session_cookie ?? "",
  };
}

export function KiloCodeSetup({ connectionId, config, setConfig }: LlmProviderSetupProps) {
  const [current, setCurrent] = useState<KiloCodeConnectionConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const field = (key: keyof KiloCodeConnectionConfig, value: string) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (value === current[key]) return;
    setStatus("saving");
    void setConfig(next).then((result) => setStatus(result.success ? "saved" : "error"));
  };

  return (
    <div key={connectionId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Session Cookie
        <Input
          type="password"
          defaultValue={current.session_cookie}
          placeholder="__Secure-next-auth.session-token value"
          onBlur={(event) => field("session_cookie", event.target.value.trim())}
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
