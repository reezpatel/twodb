import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Select, Switch } from "@twodb/ui";
import type { TwodbConnectionGovernance, TwodbConnectionOverrides, TwodbQuotaPeriod, TwodbTruncationPolicyType, TwodbUsageSnapshot } from "@twodb/contracts";
import type { LlmConnection } from "../../../shared/api";
import { TRUNCATION_OPTIONS, useLlmSettings } from "./use-llm-settings";
import { llmRepo } from "../../lib/api";

const QUOTA_PERIOD_OPTIONS: Array<{ value: TwodbQuotaPeriod; label: string }> = [
  { value: "monthly", label: "Monthly (30d)" },
  { value: "weekly", label: "Weekly (7d)" },
  { value: "5h", label: "Rolling 5h" },
];

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 20,
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  background: "var(--surface)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: "var(--text-sm)",
  color: "var(--ink-3)",
};

function WorkspaceDefaults() {
  const { overview, modelOptions, defaultModelValue, savePercent, saveTruncation, saveDefaultModel, saveQueueMaxWait } = useLlmSettings();
  if (!overview) return null;
  const { settings } = overview;

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: 0, fontSize: "var(--text-lg)", color: "var(--ink)" }}>Workspace defaults</h2>

      <label style={labelStyle}>
        Effective context window (%)
        <Input
          type="number"
          min={10}
          max={100}
          defaultValue={settings.effective_context_window_percent}
          key={settings.effective_context_window_percent}
          onBlur={(event) => savePercent(Number(event.target.value))}
        />
      </label>

      <label style={labelStyle}>
        Truncation policy
        <Select
          options={TRUNCATION_OPTIONS}
          value={settings.truncation_policy.type}
          onValueChange={(value) => saveTruncation(value as (typeof TRUNCATION_OPTIONS)[number]["value"])}
        />
      </label>

      <label style={labelStyle}>
        Default model
        <Select options={[{ value: "", label: "None" }, ...modelOptions]} value={defaultModelValue} onValueChange={saveDefaultModel} />
      </label>

      <label style={labelStyle}>
        Queue max wait (ms) — how long held requests wait when a connection hits a limit
        <Input
          type="number"
          min={0}
          max={600000}
          step={1000}
          defaultValue={settings.queue.max_wait_ms}
          key={settings.queue.max_wait_ms}
          onBlur={(event) => saveQueueMaxWait(Number(event.target.value))}
        />
      </label>
    </div>
  );
}

const WINDOW_LABELS: Record<string, string> = { "5h": "5h", weekly: "7d", monthly: "30d" };

const quotaLabel = (quota: Extract<TwodbUsageSnapshot, { kind: "quota" }>["quotas"][number]): string =>
  quota.kind === "percent"
    ? `${WINDOW_LABELS[quota.window] ?? quota.window}: ${Math.round(quota.used_percent)}% used`
    : `${WINDOW_LABELS[quota.window] ?? quota.window}: ${quota.limit !== null ? `${quota.used} / ${quota.limit} credits` : `${quota.used} credits`}`;

function UsageSummary({ connectionId }: { connectionId: string }) {
  const usageQuery = useQuery({
    queryKey: ["llm", "usage", connectionId],
    queryFn: () => llmRepo.getConnectionUsage(connectionId),
    enabled: connectionId !== "",
    retry: false,
    staleTime: 60_000,
  });

  if (!usageQuery.data) return null;
  const { usage } = usageQuery.data as { usage: TwodbUsageSnapshot };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
      {usage.kind === "cost" ? (
        <span>Balance: {usage.balance.amount !== null ? `${usage.balance.amount}${usage.balance.currency ? ` ${usage.balance.currency}` : ""}` : "—"}</span>
      ) : (
        usage.quotas.map((quota) => <span key={`${quota.kind}-${quota.window}`}>{quotaLabel(quota)}</span>)
      )}
    </div>
  );
}

function GovernanceEditor({ connection }: { connection: LlmConnection }) {
  const { actions } = useLlmSettings();
  const existing = ((connection.overrides ?? {}) as TwodbConnectionOverrides).governance ?? {};
  const [concurrency, setConcurrency] = useState(existing.concurrency?.toString() ?? "");
  const [rateRequests, setRateRequests] = useState(existing.rate_limit?.requests.toString() ?? "");
  const [rateMinutes, setRateMinutes] = useState(existing.rate_limit?.window_minutes.toString() ?? "");
  const [quotas, setQuotas] = useState<Array<{ period: TwodbQuotaPeriod; input: string; output: string }>>(
    (existing.limits ?? []).map((limit) => ({
      period: limit.period,
      input: limit.input_tokens?.toString() ?? "",
      output: limit.output_tokens?.toString() ?? "",
    })),
  );

  const save = () => {
    const next: TwodbConnectionGovernance = {};
    const parsedConcurrency = Number(concurrency);
    if (concurrency.trim() !== "" && Number.isInteger(parsedConcurrency) && parsedConcurrency > 0) next.concurrency = parsedConcurrency;

    const parsedRequests = Number(rateRequests);
    const parsedMinutes = Number(rateMinutes);
    if (rateRequests.trim() !== "" && rateMinutes.trim() !== "" && parsedRequests > 0 && parsedMinutes > 0) {
      next.rate_limit = { requests: parsedRequests, window_minutes: parsedMinutes };
    }

    const limits = quotas
      .map((quota) => ({
        period: quota.period,
        input_tokens: quota.input.trim() === "" ? undefined : Number(quota.input),
        output_tokens: quota.output.trim() === "" ? undefined : Number(quota.output),
      }))
      .filter((quota) => quota.input_tokens !== undefined || quota.output_tokens !== undefined)
      .filter((quota) => (quota.input_tokens ?? 0) > 0 || (quota.output_tokens ?? 0) > 0);
    if (limits.length > 0) next.limits = limits;

    void actions.saveConnectionGovernance(connection.id, connection.overrides as Record<string, unknown> | null, Object.keys(next).length > 0 ? next : null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>Limits &amp; governance</span>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={labelStyle}>
          Max parallel requests
          <Input
            type="number"
            min={1}
            placeholder="unlimited"
            value={concurrency}
            onChange={(event) => setConcurrency(event.target.value)}
            style={{ width: 150 }}
          />
        </label>
        <label style={labelStyle}>
          Rate — requests
          <Input type="number" min={1} placeholder="30" value={rateRequests} onChange={(event) => setRateRequests(event.target.value)} style={{ width: 110 }} />
        </label>
        <label style={labelStyle}>
          per minutes
          <Input type="number" min={1} placeholder="20" value={rateMinutes} onChange={(event) => setRateMinutes(event.target.value)} style={{ width: 110 }} />
        </label>
      </div>

      {quotas.map((quota, index) => (
        <div key={index} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={labelStyle}>
            Token quota
            <div style={{ width: 150 }}>
              <Select
                options={QUOTA_PERIOD_OPTIONS}
                value={quota.period}
                onValueChange={(value) =>
                  setQuotas((current) => current.map((entry, i) => (i === index ? { ...entry, period: value as TwodbQuotaPeriod } : entry)))
                }
              />
            </div>
          </label>
          <label style={labelStyle}>
            Input tokens
            <Input
              type="number"
              min={1}
              placeholder="—"
              value={quota.input}
              onChange={(event) => setQuotas((current) => current.map((entry, i) => (i === index ? { ...entry, input: event.target.value } : entry)))}
              style={{ width: 130 }}
            />
          </label>
          <label style={labelStyle}>
            Output tokens
            <Input
              type="number"
              min={1}
              placeholder="—"
              value={quota.output}
              onChange={(event) => setQuotas((current) => current.map((entry, i) => (i === index ? { ...entry, output: event.target.value } : entry)))}
              style={{ width: 130 }}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setQuotas((current) => current.filter((_, i) => i !== index))}>
            ✕
          </Button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={() => setQuotas((current) => [...current, { period: "monthly", input: "", output: "" }])}>
          + Token quota
        </Button>
        <Button variant="secondary" size="sm" onClick={save}>
          Save governance
        </Button>
      </div>
    </div>
  );
}

function ConnectionCard({ connection }: { connection: LlmConnection }) {
  const { providerById, setupFor, actions } = useLlmSettings();
  const provider = providerById.get(connection.provider);
  const Setup = setupFor(connection);
  const overrides = (connection.overrides ?? {}) as TwodbConnectionOverrides;
  const [name, setName] = useState(connection.name);

  const saveOverrides = (next: TwodbConnectionOverrides | null) => {
    const isEmpty = next === null || (next.effective_context_window_percent === undefined && next.truncation_policy === undefined && !next.models);
    void actions.saveConnectionOverrides(connection.id, isEmpty ? null : (next as Record<string, unknown>));
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)" }}>{provider?.name ?? connection.provider}</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && name !== connection.name && void actions.saveConnectionName(connection.id, name.trim())}
          style={{ flex: 1 }}
          aria-label="Connection name"
        />
        <Switch label="Enabled" checked={connection.enabled} onChange={(event) => void actions.toggleConnection(connection.id, event.target.checked)} />
        <Button variant="ghost" size="sm" onClick={() => void actions.removeConnection(connection.id)}>
          Remove
        </Button>
      </div>

      {Setup ? (
        <Setup connectionId={connection.id} config={connection.config} setConfig={(config) => actions.setConnectionConfig(connection.id, config)} />
      ) : (
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
          Provider plugin not installed — connection kept, but its setup UI and completions are unavailable.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>Tuning overrides (optional)</span>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={labelStyle}>
            Context window (%)
            <Input
              type="number"
              min={10}
              max={100}
              placeholder="workspace default"
              defaultValue={overrides.effective_context_window_percent ?? ""}
              key={`${connection.id}-${overrides.effective_context_window_percent ?? "none"}`}
              onBlur={(event) => {
                const raw = event.target.value.trim();
                const percent = raw === "" ? undefined : Number(raw);
                if (percent !== undefined && (!Number.isFinite(percent) || percent < 10 || percent > 100)) return;
                saveOverrides({ ...overrides, effective_context_window_percent: percent });
              }}
              style={{ width: 170 }}
            />
          </label>
          <label style={labelStyle}>
            Truncation policy
            <Select
              options={[{ value: "", label: "Workspace default" }, ...TRUNCATION_OPTIONS]}
              value={overrides.truncation_policy?.type ?? ""}
              onValueChange={(value) =>
                saveOverrides(
                  value === ""
                    ? { ...overrides, truncation_policy: undefined }
                    : { ...overrides, truncation_policy: { type: value as TwodbTruncationPolicyType } },
                )
              }
            />
          </label>
        </div>
      </div>

      <UsageSummary connectionId={connection.id} />

      <GovernanceEditor connection={connection} />
    </div>
  );
}

function AddConnection() {
  const { overview, actions } = useLlmSettings();
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");

  if (!overview || overview.providers.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
        No LLM provider plugins installed. Install a provider plugin to add connections.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={labelStyle}>
        Provider
        <div style={{ width: 180 }}>
          <Select
            options={overview.providers.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            value={provider || overview.providers[0].id}
            onValueChange={setProvider}
          />
        </div>
      </label>
      <label style={labelStyle}>
        Name
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Personal key" style={{ width: 200 }} />
      </label>
      <Button
        variant="secondary"
        onClick={() => {
          const target = provider || overview.providers[0].id;
          if (!name.trim()) return;
          void actions.addConnection(target, name.trim()).then(() => setName(""));
        }}
      >
        Add connection
      </Button>
    </div>
  );
}

export function LlmSettings() {
  const { overviewQuery, overview } = useLlmSettings();

  if (overviewQuery.isPending) return <p style={{ color: "var(--ink-3)" }}>Loading…</p>;
  if (overviewQuery.isError) return <p style={{ color: "var(--ink)" }}>Could not load LLM settings.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: "var(--text-xl)", color: "var(--ink)" }}>LLM providers</h1>
      <AddConnection />
      {(overview?.connections ?? []).map((connection) => (
        <ConnectionCard key={connection.id} connection={connection} />
      ))}
      <WorkspaceDefaults />
    </div>
  );
}
