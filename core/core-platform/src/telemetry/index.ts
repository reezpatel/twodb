// @twodb/core-platform/telemetry
//
// Shared structured logging + a tiny in-memory counter/timer so TwoDB's
// admin UI can show cross-app health without every app wiring up its own
// metrics stack. Deliberately minimal (no Prometheus/OTel exporter yet) —
// grow this only when a real app needs it.

import pino, { type Logger } from "pino";

export function createLogger(appSlug: string, level: string = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({ name: appSlug, level });
}

export interface Metrics {
  increment(name: string, by?: number): void;
  observe(name: string, value: number): void;
  snapshot(): Record<string, { count: number; sum: number; avg: number }>;
}

export function createMetrics(): Metrics {
  const counters = new Map<string, { count: number; sum: number }>();

  function bump(name: string, count: number, sum: number) {
    const existing = counters.get(name) ?? { count: 0, sum: 0 };
    existing.count += count;
    existing.sum += sum;
    counters.set(name, existing);
  }

  return {
    increment(name, by = 1) {
      bump(name, by, by);
    },
    observe(name, value) {
      bump(name, 1, value);
    },
    snapshot() {
      const out: Record<string, { count: number; sum: number; avg: number }> = {};
      for (const [name, { count, sum }] of counters) {
        out[name] = { count, sum, avg: count ? sum / count : 0 };
      }
      return out;
    },
  };
}
