import type { TwodbConnectionGovernance, TwodbQuotaPeriod } from "@twodb/contracts";

const PERIOD_MS: Record<TwodbQuotaPeriod, number> = {
  monthly: 30 * 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
  "5h": 5 * 60 * 60_000,
};

const RETENTION_MS = PERIOD_MS.monthly;
const POLL_MS = 200;

type UsageRecord = { t: number; input: number; output: number };

type ConnState = {
  inflight: number;
  rateHits: number[];
  usage: UsageRecord[];
};

// single-process in-memory state — usage tracking resets on api restart
const states = new Map<string, ConnState>();

const stateFor = (id: string): ConnState => {
  let state = states.get(id);
  if (!state) {
    state = { inflight: 0, rateHits: [], usage: [] };
    states.set(id, state);
  }
  return state;
};

type BlockReason = "rate_limited" | "quota_exceeded" | "concurrency";
type Blocked = { reason: BlockReason; retry_after_ms: number };

const blockedBy = (state: ConnState, governance: TwodbConnectionGovernance, now: number): Blocked | null => {
  const rate = governance.rate_limit;
  if (rate) {
    const windowMs = rate.window_minutes * 60_000;
    state.rateHits = state.rateHits.filter((t) => t > now - windowMs);
    if (state.rateHits.length >= rate.requests) {
      return { reason: "rate_limited", retry_after_ms: state.rateHits[0] + windowMs - now };
    }
  }

  for (const quota of governance.limits ?? []) {
    const cutoff = now - PERIOD_MS[quota.period];
    let input = 0;
    let output = 0;
    let oldest = now;
    for (const record of state.usage) {
      if (record.t > cutoff) {
        input += record.input;
        output += record.output;
        if (record.t < oldest) oldest = record.t;
      }
    }
    const overInput = quota.input_tokens !== undefined && input >= quota.input_tokens;
    const overOutput = quota.output_tokens !== undefined && output >= quota.output_tokens;
    if (overInput || overOutput) {
      return { reason: "quota_exceeded", retry_after_ms: Math.max(oldest + PERIOD_MS[quota.period] - now, 0) };
    }
  }

  if (governance.concurrency !== undefined && state.inflight >= governance.concurrency) {
    return { reason: "concurrency", retry_after_ms: POLL_MS };
  }

  return null;
};

export type GovernorLease = {
  ok: true;
  addUsage: (inputTokens: number, outputTokens: number) => void;
  release: () => void;
};

export type GovernorRefusal = {
  ok: false;
  reason: BlockReason;
  retry_after_ms: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function acquire(connectionId: string, governance: TwodbConnectionGovernance, maxWaitMs: number): Promise<GovernorLease | GovernorRefusal> {
  const state = stateFor(connectionId);
  const deadline = Date.now() + Math.max(0, maxWaitMs);

  for (;;) {
    const now = Date.now();
    const blocked = blockedBy(state, governance, now);
    if (!blocked) {
      state.inflight += 1;
      state.rateHits.push(now);
      let released = false;
      return {
        ok: true,
        addUsage: (inputTokens, outputTokens) => {
          if (inputTokens <= 0 && outputTokens <= 0) return;
          state.usage.push({ t: Date.now(), input: inputTokens, output: outputTokens });
          state.usage = state.usage.filter((record) => record.t > Date.now() - RETENTION_MS);
        },
        release: () => {
          if (!released) {
            released = true;
            state.inflight -= 1;
          }
        },
      };
    }

    if (now >= deadline) {
      return { ok: false, reason: blocked.reason, retry_after_ms: Math.max(blocked.retry_after_ms, 0) };
    }
    await sleep(Math.min(POLL_MS, Math.max(deadline - now, 1)));
  }
}

export function governanceSnapshot(connectionId: string, governance: TwodbConnectionGovernance) {
  const state = stateFor(connectionId);
  const now = Date.now();

  const rateWindowMs = governance.rate_limit ? governance.rate_limit.window_minutes * 60_000 : 0;
  const rate = governance.rate_limit
    ? {
        limit: governance.rate_limit.requests,
        window_minutes: governance.rate_limit.window_minutes,
        requests_used: state.rateHits.filter((t) => t > now - rateWindowMs).length,
      }
    : null;

  const quotas = (governance.limits ?? []).map((quota) => {
    const cutoff = now - PERIOD_MS[quota.period];
    let input = 0;
    let output = 0;
    for (const record of state.usage) {
      if (record.t > cutoff) {
        input += record.input;
        output += record.output;
      }
    }
    return {
      period: quota.period,
      input_tokens_limit: quota.input_tokens ?? null,
      output_tokens_limit: quota.output_tokens ?? null,
      input_tokens_used: input,
      output_tokens_used: output,
    };
  });

  return { inflight: state.inflight, inflight_limit: governance.concurrency ?? null, rate, quotas };
}
