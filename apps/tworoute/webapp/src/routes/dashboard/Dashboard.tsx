import { DraggableWidgetGrid, type WidgetItem } from "@twodb/blocks";
import { useSharedConnections } from "../../lib/connections-context.js";
import { useAnalytics } from "./hooks/useAnalytics.js";
import { CallsWidget } from "./partials/CallsWidget.js";
import { QuotaWidget } from "./partials/QuotaWidget.js";
import { CostWidget, ErrorsWidget, LatencyWidget, ModelsWidget, StatusWidget, TokensWidget, ToolCallsWidget } from "./partials/AnalyticsWidgets.js";
import type { CachedModel } from "../../lib/tworoute-client.js";

/** Dashboard — REAL analytics (usage_log + llm_quota + llm_model caches):
 * calls yearly grid, 24h tokens/cost/status/latency/model share, live quota
 * windows. The aggregate board (scope=null) sums across every connection;
 * a per-connection board scopes to it. Layout stays draggable. */
export function Dashboard({ scope }: { scope: string | null }) {
  const conn = useSharedConnections();
  const active = scope ? conn.connections.find((c) => c.name === scope) ?? null : null;
  const { summary, buckets, tools, loading } = useAnalytics(active?.id ?? null);

  // Cached model metadata (prices) per connection — the cost widget needs it.
  const modelsByConnection = new Map<string, CachedModel[]>();
  for (const [cid, models] of Object.entries(conn.models)) modelsByConnection.set(cid, models);

  const scopedSummary = active ? summary : summary;
  void scopedSummary;

  const items: WidgetItem[] = [
    { id: "calls", size: "wide", label: "Calls" },
    { id: "tokens", size: "sm", label: "Tokens" },
    { id: "cost", size: "sm", label: "Cost" },
    { id: "status", size: "sm", label: "Status" },
    { id: "latency", size: "sm", label: "Latency" },
    { id: "errors", size: "sm", label: "Errors" },
    { id: "quota", size: "wide", label: "Quotas" },
    { id: "models", size: "wide", label: "Token usage by model" },
    { id: "tool_calls", size: "wide", label: "Tool calls" },
  ];

  return (
    <div className="w-full max-w-6xl p-6">
      {loading ? (
        <p className="mb-4 text-[13px] text-ink-muted">Loading analytics…</p>
      ) : null}
      <DraggableWidgetGrid
        className="max-w-full"
        maxColumns={4}
        items={items}
        renderItem={(item) => {
          switch (item.id) {
            case "calls":
              return <CallsWidget buckets={buckets} connections={conn.connections} />;
            case "tokens":
              return <TokensWidget rows={summary} />;
            case "cost":
              return <CostWidget rows={summary} modelsByConnection={modelsByConnection} />;
            case "status":
              return <StatusWidget rows={summary} />;
            case "latency":
              return <LatencyWidget rows={summary} />;
            case "errors":
              return <ErrorsWidget rows={summary} />;
            case "quota":
              return <QuotaWidget scope={scope} />;
            case "models":
              return <ModelsWidget rows={summary} />;
            case "tool_calls":
              return <ToolCallsWidget tools={tools} />;
            default:
              return null;
          }
        }}
      />
    </div>
  );
}
