import { useEffect, useState } from "react";

export function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Elapsed label for a tool call or thinking span: ticking while running, "took Xs" once completed. */
export function useElapsed(startedAt?: number, completedAt?: number): string | undefined {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (completedAt || !startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, completedAt]);
  if (!startedAt) return undefined;
  const ms = (completedAt ?? now) - startedAt;
  if (ms < 0) return undefined;
  return completedAt ? `took ${fmtDuration(ms)}` : fmtDuration(ms);
}
