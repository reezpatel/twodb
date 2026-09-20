import { useState } from "react";
import { Input } from "@twodb/ui";

export type NodePluginConfig = {
  offline_wait_ms: number;
};

const DEFAULTS: NodePluginConfig = { offline_wait_ms: 300_000 };

function mergeConfig(raw: unknown): NodePluginConfig {
  const stored = (raw ?? {}) as Partial<NodePluginConfig>;
  const wait = typeof stored.offline_wait_ms === "number" ? stored.offline_wait_ms : DEFAULTS.offline_wait_ms;
  return { offline_wait_ms: Math.min(Math.max(Math.round(wait), 0), 3_600_000) };
}

export function AdminSettings({ config, setConfig }: { config: unknown; setConfig: (data: unknown) => Promise<{ success: boolean; errors?: string[] }> }) {
  const [current, setCurrent] = useState<NodePluginConfig>(() => mergeConfig(config));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = async (next: NodePluginConfig) => {
    setStatus("saving");
    const result = await setConfig(next);
    setStatus(result.success ? "saved" : "error");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        Offline wait (minutes) — how long agent tool calls wait for an offline machine before failing
        <Input
          type="number"
          min={0}
          max={60}
          step={1}
          key={current.offline_wait_ms}
          defaultValue={current.offline_wait_ms / 60_000}
          onBlur={(event) => {
            const minutes = Math.min(Math.max(Number(event.target.value) || 0, 0), 60);
            const next = { offline_wait_ms: Math.round(minutes * 60_000) };
            setCurrent(next);
            void save(next);
          }}
        />
      </label>
      {status === "saving" ? <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>saving…</span> : null}
      {status === "saved" ? <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>saved</span> : null}
      {status === "error" ? <span style={{ fontSize: "var(--text-sm)", color: "var(--danger-ink)" }}>save failed</span> : null}
    </div>
  );
}
