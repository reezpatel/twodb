import { useMemo } from "react";
import type { TwodbConnectionGovernance, TwodbTruncationPolicyType } from "@twodb/contracts";
import { getLlmProviderSetup } from "@twodb/shared-frontend";
import type { LlmConnection } from "../../../shared/api";
import { useLlmData } from "../../hooks/use-llm-data";

export const TRUNCATION_OPTIONS: Array<{ value: TwodbTruncationPolicyType; label: string }> = [
  { value: "keep_system_first", label: "Keep system first" },
  { value: "sliding_window", label: "Sliding window" },
  { value: "drop_oldest_turns", label: "Drop oldest turns" },
  { value: "none", label: "No truncation" },
];

export function useLlmSettings() {
  const { overviewQuery, saveSettings, createConnection, updateConnection, removeConnection } = useLlmData();

  const overview = overviewQuery.data;

  const providerById = useMemo(() => new Map((overview?.providers ?? []).map((provider) => [provider.id, provider])), [overview]);

  const modelOptions = useMemo(
    () =>
      (overview?.providers ?? []).flatMap((provider) =>
        provider.models
          .filter((model) => !model.deprecated)
          .map((model) => ({ value: `${provider.id}|${model.id}`, label: `${provider.name} · ${model.display_name}` })),
      ),
    [overview],
  );

  const defaultModelValue = overview?.settings.default_model ? `${overview.settings.default_model.provider}|${overview.settings.default_model.model}` : "";

  const savePercent = (percent: number) => {
    if (!overview) return;
    if (!Number.isFinite(percent) || percent < 10 || percent > 100) return;
    if (percent === overview.settings.effective_context_window_percent) return;
    saveSettings.mutate({ effective_context_window_percent: percent });
  };

  const saveTruncation = (type: TwodbTruncationPolicyType) => {
    if (!overview) return;
    if (type === overview.settings.truncation_policy.type) return;
    saveSettings.mutate({ truncation_policy: { type } });
  };

  const saveDefaultModel = (value: string) => {
    if (!overview) return;
    const next =
      value === ""
        ? null
        : (() => {
            const [provider, model] = value.split("|");
            return provider && model ? { provider, model } : null;
          })();
    const current = overview.settings.default_model;
    if ((next?.provider ?? null) === (current?.provider ?? null) && (next?.model ?? null) === (current?.model ?? null)) return;
    saveSettings.mutate({ default_model: next });
  };

  const saveQueueMaxWait = (maxWaitMs: number) => {
    if (!overview) return;
    if (!Number.isInteger(maxWaitMs) || maxWaitMs < 0 || maxWaitMs > 600_000) return;
    if (maxWaitMs === overview.settings.queue.max_wait_ms) return;
    saveSettings.mutate({ queue: { max_wait_ms: maxWaitMs } });
  };

  const setupFor = (connection: LlmConnection) => getLlmProviderSetup(connection.provider);

  const setConnectionConfig = async (connectionId: string, config: unknown) => {
    try {
      await llmUpdate(connectionId, { config: config as Record<string, unknown> });
      return { success: true as const };
    } catch (error) {
      return { success: false as const, errors: [error instanceof Error ? error.message : String(error)] };
    }
  };

  const llmUpdate = async (id: string, body: Parameters<typeof updateConnection.mutateAsync>[0]["body"]) => {
    await updateConnection.mutateAsync({ id, body });
  };

  return {
    overviewQuery,
    overview,
    providerById,
    modelOptions,
    defaultModelValue,
    savePercent,
    saveTruncation,
    saveDefaultModel,
    saveQueueMaxWait,
    setupFor,
    actions: {
      addConnection: (provider: string, name: string) => createConnection.mutateAsync({ provider, name }),
      setConnectionConfig,
      saveConnectionName: (id: string, name: string) => llmUpdate(id, { name }),
      saveConnectionOverrides: (id: string, overrides: Record<string, unknown> | null) => llmUpdate(id, { overrides }),
      toggleConnection: (id: string, enabled: boolean) => llmUpdate(id, { enabled }),
      saveConnectionGovernance: (id: string, currentOverrides: Record<string, unknown> | null, governance: TwodbConnectionGovernance | null) => {
        const overrides = { ...(currentOverrides ?? {}), governance: governance ?? undefined };
        const isEmpty = Object.keys(overrides).length === 0;
        return llmUpdate(id, { overrides: isEmpty ? null : overrides });
      },
      removeConnection: (id: string) => removeConnection.mutateAsync(id),
    },
  };
}
