import { useCallback, useEffect, useState } from "react";
import { tworouteClient } from "../../../lib/tworoute-client.js";

export interface SummaryRow {
  connectionId: string;
  model: string;
  calls: number;
  completed: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
}

export interface CallBucket {
  connectionId: string;
  day: string;
  calls: number;
  completed: number;
  failed: number;
}

export interface ToolStat {
  name: string;
  calls: number;
  completed: number;
  failed: number;
}

/**
 * Business hook: the 24h usage summary + a year of daily call buckets that
 * back the dashboard widgets. `scope` is a connection id (or null for the
 * aggregate board). Everything is derived from usage_log — no extra tables.
 */
export function useAnalytics(scope: string | null) {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [buckets, setBuckets] = useState<CallBucket[]>([]);
  const [tools, setTools] = useState<ToolStat[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, t] = await Promise.all([
        tworouteClient.analyticsSummary(scope ?? undefined),
        tworouteClient.analyticsCalls(scope ?? undefined),
        tworouteClient.analyticsTools(scope ?? undefined),
      ]);
      setSummary(s.rows);
      setBuckets(c.buckets);
      setTools(t.tools);
    } catch {
      setSummary([]);
      setBuckets([]);
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, buckets, tools, loading, refresh };
}
