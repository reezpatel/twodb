import type {
  TwodbConnectionGovernance,
  TwodbConnectionOverrides,
  TwodbLlmWorkspaceSettings,
  TwodbModelInfo,
  TwodbQuotaPeriod,
  TwodbTruncationPolicy,
} from "@twodb/contracts";
import type { LlmConnection } from "../shared/api";

export const DEFAULT_WORKSPACE_SETTINGS: TwodbLlmWorkspaceSettings = {
  effective_context_window_percent: 90,
  truncation_policy: { type: "keep_system_first" },
  default_model: null,
  queue: { max_wait_ms: 120_000 },
};

const POLICY_TYPES: TwodbTruncationPolicy["type"][] = ["keep_system_first", "sliding_window", "drop_oldest_turns", "none"];
const QUOTA_PERIODS: TwodbQuotaPeriod[] = ["monthly", "weekly", "5h"];

const positiveInt = (raw: unknown, max: number): number | undefined => {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= max ? value : undefined;
};

export function coerceSettings(raw: {
  effective_context_window_percent: number;
  truncation_policy: Record<string, unknown> | null;
  default_model: Record<string, unknown> | null;
  queue: Record<string, unknown> | null;
}): TwodbLlmWorkspaceSettings {
  const percent = raw.effective_context_window_percent;
  const policyRaw = raw.truncation_policy as Partial<TwodbTruncationPolicy> | null;
  const type = POLICY_TYPES.includes(policyRaw?.type as TwodbTruncationPolicy["type"])
    ? (policyRaw!.type as TwodbTruncationPolicy["type"])
    : DEFAULT_WORKSPACE_SETTINGS.truncation_policy.type;
  const dm = raw.default_model as { provider?: unknown; model?: unknown } | null;

  return {
    effective_context_window_percent:
      Number.isFinite(percent) && percent >= 10 && percent <= 100 ? percent : DEFAULT_WORKSPACE_SETTINGS.effective_context_window_percent,
    truncation_policy: {
      type,
      ...(typeof policyRaw?.max_turns === "number" ? { max_turns: policyRaw.max_turns } : {}),
      ...(typeof policyRaw?.preserve_tool_pairs === "boolean" ? { preserve_tool_pairs: policyRaw.preserve_tool_pairs } : {}),
    },
    default_model: dm && typeof dm.provider === "string" && typeof dm.model === "string" ? { provider: dm.provider, model: dm.model } : null,
    queue: {
      max_wait_ms: positiveInt((raw.queue as { max_wait_ms?: unknown } | null)?.max_wait_ms, 600_000) ?? DEFAULT_WORKSPACE_SETTINGS.queue.max_wait_ms,
    },
  };
}

export function coerceGovernance(raw: unknown): TwodbConnectionGovernance | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const input = raw as Record<string, unknown>;
  const governance: TwodbConnectionGovernance = {};

  const concurrency = positiveInt(input.concurrency, 100);
  if (concurrency !== undefined) governance.concurrency = concurrency;

  if (input.rate_limit !== null && input.rate_limit !== undefined) {
    const rate = input.rate_limit as Record<string, unknown>;
    const requests = positiveInt(rate.requests, 1_000_000);
    const windowMinutes = positiveInt(rate.window_minutes, 10_080);
    if (requests === undefined || windowMinutes === undefined) return undefined;
    governance.rate_limit = { requests, window_minutes: windowMinutes };
  }

  if (Array.isArray(input.limits)) {
    const limits: NonNullable<TwodbConnectionGovernance["limits"]> = [];
    for (const entry of input.limits) {
      const quota = entry as Record<string, unknown>;
      if (!QUOTA_PERIODS.includes(quota.period as TwodbQuotaPeriod)) return undefined;
      const inputTokens = positiveInt(quota.input_tokens, Number.MAX_SAFE_INTEGER);
      const outputTokens = positiveInt(quota.output_tokens, Number.MAX_SAFE_INTEGER);
      if (inputTokens === undefined && outputTokens === undefined) return undefined;
      limits.push({
        period: quota.period as TwodbQuotaPeriod,
        ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
        ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
      });
    }
    if (limits.length > 0) governance.limits = limits;
  } else if (input.limits !== undefined && input.limits !== null) {
    return undefined;
  }

  return governance;
}

// model-level connection override → connection-level override → workspace default
export function resolveModelTuning(
  settings: TwodbLlmWorkspaceSettings,
  connection: Pick<LlmConnection, "overrides">,
  modelId: string,
): { effective_context_window_percent: number; truncation_policy: TwodbTruncationPolicy } {
  const overrides = connection.overrides as TwodbConnectionOverrides | null;
  const modelTuning = overrides?.models?.[modelId];
  const connectionTuning = overrides ?? {};

  const percent =
    modelTuning?.effective_context_window_percent ?? connectionTuning.effective_context_window_percent ?? settings.effective_context_window_percent;
  const policy = modelTuning?.truncation_policy ?? connectionTuning.truncation_policy ?? settings.truncation_policy;

  return {
    effective_context_window_percent: Math.min(100, Math.max(10, Math.round(percent))),
    truncation_policy: policy,
  };
}

export function effectiveContextTokens(model: Pick<TwodbModelInfo, "context_window">, percent: number): number {
  return Math.floor((model.context_window * percent) / 100);
}
