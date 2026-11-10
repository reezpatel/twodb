import { useEffect, useState } from "react";
import { CheckCircle2, Coins, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Badge, Button, Sidebar } from "@twodb/blocks";
import type { CachedModel, Connection, QuotaSnapshot, UsageTotals } from "../../../lib/tworoute-client.js";
import { ProviderLogo } from "../../../lib/provider-logo.js";
import { ModelList } from "./ModelList.js";

export interface ConnectionDetailSidebarProps {
  connection: Connection;
  providerLabel: string;
  spaceName: string;
  quotas: QuotaSnapshot[];
  usage: UsageTotals | null;
  models: CachedModel[] | null;
  busy: boolean;
  testResult: { ok: boolean; detail: string } | null;
  /** Overlay visibility below lg (the header toggle drives it). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTest: () => void;
  onLoadModels: () => void;
  onRefreshModels: () => void;
  onRefreshQuotas: () => void;
  onRemove: () => void;
  /** Sets the connection's default model (used by ModelList rows + the test fallback). */
  onSetDefault: (modelId: string) => void;
}

/** One detail row — label left, value right. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2">
      <span className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{label}</span>
      <span className="min-w-0 break-all text-right text-[13px] text-ink">{value}</span>
    </div>
  );
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ?? "mt-4"}>
      <div className="flex shrink-0 items-center justify-between px-4">
        <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{title}</p>
        {action}
      </div>
      <div className="mt-1.5 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Live 85vw cap (bounded to 720px so ultra-wide screens don't get silly),
 * tracked on resize — the Sidebar clamps both the initial width and drag
 * against it. */
function useMaxWidth(): number {
  const [max, setMax] = useState(() => (typeof window === "undefined" ? 720 : Math.min(720, Math.round(window.innerWidth * 0.85))));
  useEffect(() => {
    const onResize = () => setMax(Math.min(720, Math.round(window.innerWidth * 0.85)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return max;
}

/** Right-docked detail panel for a connection's dashboard page — everything
 * the manage page's expandable row carried, now always visible alongside the
 * widgets. Dumb — all state flows in via props. */
export function ConnectionDetailSidebar(props: ConnectionDetailSidebarProps) {
  const c = props.connection;
  const maxWidth = useMaxWidth();
  return (
    <Sidebar
      side="right"
      variant="responsive"
      open={props.open}
      onOpenChange={props.onOpenChange}
      defaultWidth={480}
      minWidth={280}
      maxWidth={maxWidth}
      className="border-l border-outline bg-card"
    >
      <div className="flex min-h-0 flex-1 flex-col pt-4">
        <div className="flex items-center gap-2 px-4 pb-1">
          <ProviderLogo provider={c.provider} className="size-4 shrink-0" />
          <span className="truncate text-[15px] font-semibold text-ink">{c.name}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 px-4">
          <Badge tone="info">{props.providerLabel}</Badge>
          <Badge tone="warning">{props.spaceName}</Badge>
        </div>

        {props.testResult ? (
          <p className={`mt-3 flex items-start gap-1.5 px-4 text-[12px] ${props.testResult.ok ? "text-success" : "text-destructive"}`}>
            {props.testResult.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <XCircle className="mt-0.5 size-3.5 shrink-0" />}
            <span className="break-all">{props.testResult.detail}</span>
          </p>
        ) : null}

        <div className="mt-4">
          <Detail label="Base URL" value={<code className="font-mono text-[12px]">{c.baseUrl || "—"}</code>} />
          <Detail label="Default model" value={c.defaultModel ? <code className="font-mono text-[12px]">{c.defaultModel}</code> : "—"} />
          <Detail label="Created" value={new Date(c.createdAt).toLocaleDateString()} />
        </div>

        {/* Usage */}
        <Section title="Usage">
          {props.usage ? (
            <div className="px-4 text-[13px] text-ink-muted">
              <p>{props.usage.requests.toLocaleString()} calls</p>
              <p className="mt-1">
                {props.usage.inputTokens.toLocaleString()} in / {props.usage.outputTokens.toLocaleString()} out tokens
              </p>
              {props.usage.lastUsedAt ? <p className="mt-1">last used {new Date(props.usage.lastUsedAt).toLocaleString()}</p> : null}
            </div>
          ) : (
            <p className="px-4 text-[13px] text-ink-muted">No usage recorded yet.</p>
          )}
        </Section>

        {/* Quotas */}
        <Section
          title="Quotas"
          action={
            <Button size="sm" variant="ghost" disabled={props.busy} onClick={props.onRefreshQuotas}>
              <RefreshCw className="size-3" />
            </Button>
          }
        >
          {props.quotas.length > 0 ? (
            <div className="flex flex-col gap-2 px-4">
              {props.quotas.map((q) => {
                // usd-unit quotas with no cap are BALANCES (Kilo's
                // pay-as-you-go pool) — the stored value is what remains,
                // not what was used. No meter, no warning tones.
                if (q.unit === "usd" && q.quotaTotal === null) {
                  return (
                    <div key={q.id} className="flex items-center justify-between text-[14px]">
                      <span className="font-semibold text-ink">{q.quotaType}</span>
                      <span className="text-ink-muted tabular-nums">${q.quotaUsed.toFixed(2)} left</span>
                    </div>
                  );
                }
                const ratio = q.quotaTotal ? q.quotaUsed / q.quotaTotal : null;
                return (
                  <div key={q.id}>
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="font-semibold text-ink">{q.quotaType}</span>
                      <span className="text-ink-muted tabular-nums">
                        {q.unit === "percent"
                          ? `${Math.round(q.quotaUsed)}%`
                          : q.unit === "usd"
                            ? `$${q.quotaUsed.toFixed(2)}${q.quotaTotal ? ` / $${q.quotaTotal.toFixed(2)}` : ""}`
                            : `${q.quotaUsed.toLocaleString()}${q.quotaTotal ? ` / ${q.quotaTotal.toLocaleString()} ${q.unit}` : ` ${q.unit}`}`}
                      </span>
                    </div>
                    {ratio !== null ? (
                      <div className="mt-1 h-[30px] overflow-hidden rounded-[3px] bg-ink/10">
                        <span
                          className={`block h-full rounded-[3px] ${ratio > 0.85 ? "bg-destructive" : ratio > 0.6 ? "bg-warning" : "bg-success"}`}
                          style={{ width: `${Math.min(100, ratio * 100)}%` }}
                        />
                      </div>
                    ) : null}
                    {q.resetAt ? <p className="mt-1 text-[12px] text-ink-muted">resets {new Date(q.resetAt).toLocaleString()}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-4 text-[13px] text-ink-muted">
              No quota snapshots — <Coins className="inline size-3" /> refresh fetches them (provider must have a collector).
            </p>
          )}
        </Section>

        {/* Models — occupies the remaining height; its list scrolls inside. */}
        <Section
          className="mt-4 flex min-h-0 flex-1 flex-col"
          title="Models"
          action={
            <Button size="sm" variant="ghost" disabled={props.busy} onClick={props.onRefreshModels}>
              <RefreshCw className="size-3" />
            </Button>
          }
        >
          <ModelList
            models={props.models}
            defaultModel={c.defaultModel}
            onLoad={props.onLoadModels}
            onSetDefault={props.onSetDefault}
          />
        </Section>
        {/* Footer actions — pinned to the panel's bottom edge. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-outline bg-paper px-4 py-3">
          <Button size="sm" variant="ghost" disabled={props.busy} onClick={props.onTest}>
            Test
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={props.busy}
            onClick={() => {
              if (confirm(`Delete connection "${c.name}"?`)) props.onRemove();
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>
    </Sidebar>
  );
}
