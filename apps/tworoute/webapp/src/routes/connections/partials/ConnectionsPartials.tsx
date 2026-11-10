import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Clock, Coins, Plug, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@twodb/blocks";
import type { CachedModel, Connection, ProviderSpec, QuotaSnapshot, UsageTotals } from "../../../lib/tworoute-client.js";
import type { Space, TestResult } from "../hooks/useConnections.js";

/** Dumb/presentational — one connection row (expandable for models + quotas + usage). */
export function ConnectionRow({
  connection,
  spaceName,
  providerLabel,
  testResult,
  models,
  quotas,
  usage,
  busy,
  onTest,
  onModels,
  onRefreshModels,
  onRefreshQuotas,
  onPatch,
  onRemove,
}: {
  connection: Connection;
  spaceName: string;
  providerLabel: string;
  testResult: TestResult | undefined;
  models: CachedModel[] | undefined;
  quotas: QuotaSnapshot[];
  usage: UsageTotals | undefined;
  busy: boolean;
  onTest: () => void;
  onModels: () => void;
  onRefreshModels: () => void;
  onRefreshQuotas: () => void;
  onPatch: (patch: { defaultModel?: string | null; spaceId?: string }) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [defaultModel, setDefaultModel] = useState(connection.defaultModel ?? "");

  useEffect(() => setDefaultModel(connection.defaultModel ?? ""), [connection.defaultModel]);

  const dirty = defaultModel !== (connection.defaultModel ?? "");

  return (
    <div className="border-b border-outline last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center outline-none"
          aria-label={expanded ? "Hide details" : "Show details"}
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((e) => !e);
            if (!expanded && !models) onModels();
          }}
        >
          <ChevronRight className={`size-4 text-ink-muted transition-transform ${expanded ? "rotate-90" : ""}`} strokeWidth={2} />
        </button>
        <Plug className="size-4 shrink-0 text-ink-muted" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14px] font-medium text-ink">{connection.name}</span>
            <Chip tone="info" dot={false}>{providerLabel}</Chip>
            <Chip tone="warning" dot={false}>{spaceName}</Chip>
          </div>
          <span className="truncate font-mono text-xs text-ink-muted">{connection.baseUrl}</span>
        </div>
        {testResult ? (
          <span className={`flex items-center gap-1 text-xs ${testResult.ok ? "text-success" : "text-destructive"}`}>
            {testResult.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            <span className="max-w-40 truncate">{testResult.detail}</span>
          </span>
        ) : null}
        <Button size="sm" variant="ghost" disabled={busy} onClick={onTest}>
          Test
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            if (confirm(`Delete connection "${connection.name}"?`)) onRemove();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-outline bg-stone/40 px-4 py-3">
          {/* Quotas */}
          {quotas.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Quotas</p>
              <div className="flex flex-wrap items-center gap-2">
                {quotas.map((q) => (
                  <QuotaChip key={q.id} q={q} />
                ))}
                <Button size="sm" variant="ghost" disabled={busy} onClick={onRefreshQuotas}>
                  <RefreshCw className="size-3" />
                  Refresh
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="self-start px-0 text-ink-muted" disabled={busy} onClick={onRefreshQuotas}>
              <Coins className="size-3" />
              Fetch quotas
            </Button>
          )}

          {/* Usage */}
          {usage ? (
            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
              <span className="text-[11px] font-semibold tracking-wide uppercase">Usage</span>
              <span>{usage.requests} calls</span>
              <span>{usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out tokens</span>
              {usage.lastUsedAt ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  last {new Date(usage.lastUsedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Models + default model */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Models</p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onRefreshModels}>
                <RefreshCw className="size-3" />
                Refresh
              </Button>
            </div>
            {models ? (
              models.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {models.map((m) => (
                    <code
                      key={m.modelId}
                      title={`${m.displayName ?? m.modelId}${m.contextWindow ? ` · ${m.contextWindow.toLocaleString()} ctx` : ""}`}
                      className="rounded-[6px] border border-outline bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
                    >
                      {m.modelId}
                      {m.thinking ? " ✦" : ""}
                    </code>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-ink-muted">No models cached — refresh.</p>
              )
            ) : (
              <p className="text-[13px] text-ink-muted">Loading models…</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Label className="text-[12px]">Default model</Label>
              <Input
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder={models?.[0]?.modelId ?? "pick a model"}
                className="h-8 max-w-64 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || !dirty}
                onClick={() => onPatch({ defaultModel: defaultModel.trim() || null })}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Dumb/presentational — one quota window as a chip with a meter. */
function QuotaChip({ q }: { q: QuotaSnapshot }) {
  const pct = q.quotaTotal ? Math.min(100, (q.quotaUsed / q.quotaTotal) * 100) : null;
  const tone = pct === null ? "neutral" : pct < 60 ? "ok" : pct < 90 ? "warn" : "hot";
  const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));
  return (
    <span
      title={`${q.quotaType} (${q.groupName}) — captured ${new Date(q.capturedAt).toLocaleString()}${q.resetAt ? ` · resets ${new Date(q.resetAt).toLocaleString()}` : ""}`}
      className="flex items-center gap-2 rounded-full border border-outline bg-paper px-2.5 py-1 text-[11px] text-ink-muted"
    >
      <span
        className={
          tone === "ok" ? "size-1.5 rounded-full bg-success" : tone === "warn" ? "size-1.5 rounded-full bg-warning" : tone === "hot" ? "size-1.5 rounded-full bg-destructive" : "size-1.5 rounded-full bg-ink-muted"
        }
      />
      <span className="font-semibold">{q.quotaType}</span>
      <span>
        {q.quotaTotal !== null ? `${fmt(q.quotaUsed)} / ${fmt(q.quotaTotal)} ${q.unit}` : `${fmt(q.quotaUsed)} ${q.unit}`}
      </span>
    </span>
  );
}

/** Dumb/presentational — the add-connection dialog, provider-driven. */
export function AddConnectionDialog({
  spaces,
  providers,
  busy,
  oauthBusy,
  onCreate,
  onRunOauth,
}: {
  spaces: Space[];
  providers: ProviderSpec[];
  busy: boolean;
  oauthBusy: boolean;
  onCreate: (input: { spaceId: string; name: string; provider: string; baseUrl?: string; apiKey?: string; defaultModel?: string; config?: Record<string, string> }) => void;
  onRunOauth: (provider: "claude-code" | "codex") => Promise<{ accessToken: string; refreshToken: string; accountId?: string | null } | null>;
}) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState("anthropic");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [name, setName] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const /** Values for the spec's fields — apiKey, baseUrl, org, tokens… */
    [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [oauthState, setOauthState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [oauthError, setOauthError] = useState<string | null>(null);

  const spec = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId]);
  const isOauth = spec?.auth === "claude-oauth" || spec?.auth === "codex-oauth";

  useEffect(() => {
    // Provider switch → prefill base URL + first static model.
    if (spec?.defaultBaseUrl) setFieldValues((v) => ({ ...v, baseUrl: spec.defaultBaseUrl! }));
    else setFieldValues((v) => ({ ...v, baseUrl: "" }));
    if (spec?.models[0]) setDefaultModel(spec.models[0]);
    setOauthState("idle");
    setOauthError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, providers]);

  const startOauth = async () => {
    setOauthState("waiting");
    setOauthError(null);
    try {
      const result = await onRunOauth(providerId as "claude-code" | "codex");
      if (result) {
        setFieldValues((v) => ({
          ...v,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          ...(result.accountId ? { accountId: String(result.accountId) } : {}),
        }));
        setOauthState("done");
      } else {
        setOauthState("error");
        setOauthError("Sign-in didn't complete (timed out waiting for the callback)");
      }
    } catch (e) {
      setOauthState("error");
      setOauthError(e instanceof Error ? e.message : String(e));
    }
  };

  const fieldOk = (key: string) => (fieldValues[key] ?? "").trim().length > 0;
  const requiredFieldsOk = (spec?.fields ?? []).filter((f) => !f.optional).every((f) => fieldOk(f.key));
  const canSubmit = spaceId && name.trim() && spec && requiredFieldsOk && !busy && (!isOauth || oauthState === "done");

  const submit = () => {
    const config: Record<string, string> = {};
    for (const f of spec?.fields ?? []) {
      const val = (fieldValues[f.key] ?? "").trim();
      if (val && f.key !== "apiKey" && f.key !== "baseUrl") config[f.key] = val;
    }
    onCreate({
      spaceId,
      name: name.trim(),
      provider: providerId,
      baseUrl: (fieldValues.baseUrl ?? "").trim() || spec?.defaultBaseUrl,
      apiKey: (fieldValues.apiKey ?? "").trim() || undefined,
      defaultModel: defaultModel.trim() || undefined,
      config: Object.keys(config).length ? config : undefined,
    });
    setName("");
    setFieldValues({});
    setDefaultModel("");
    setOauthState("idle");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Add connection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="sr-only">Add connection</DialogTitle>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="conn-provider">Provider</Label>
            <select
              id="conn-provider"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="h-9 rounded-[6px] border border-outline bg-paper px-2 font-sans text-[13px] text-ink outline-none"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="conn-space">Space</Label>
            <select
              id="conn-space"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="h-9 rounded-[6px] border border-outline bg-paper px-2 font-sans text-[13px] text-ink outline-none"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="conn-name">Name</Label>
            <Input id="conn-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. anthropic-prod" />
          </div>

          {isOauth ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-outline bg-stone/60 p-3">
              <p className="text-[13px] text-ink-muted">
                {spec?.label} signs in with OAuth — a browser window opens; tokens arrive automatically.
              </p>
              <Button size="sm" className="self-start" disabled={oauthBusy || oauthState === "waiting"} onClick={() => void startOauth()}>
                {oauthState === "waiting" ? "Waiting for sign-in…" : oauthState === "done" ? "Signed in ✓" : "Sign in with OAuth"}
              </Button>
              {oauthError ? <p className="text-[13px] text-destructive">{oauthError}</p> : null}
            </div>
          ) : null}

          {(spec?.fields ?? []).map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`conn-${f.key}`}>
                {f.label}
                {f.optional ? <span className="text-ink-muted"> (optional)</span> : null}
              </Label>
              <Input
                id={`conn-${f.key}`}
                type={f.secret ? "password" : "text"}
                value={fieldValues[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          <div className="grid gap-1.5">
            <Label htmlFor="conn-model">
              Default model
              <span className="text-ink-muted"> (optional)</span>
            </Label>
            <Input
              id="conn-model"
              list="conn-model-list"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="pick from the list or type freely"
            />
            <datalist id="conn-model-list">
              {(spec?.models ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <p className="text-[13px] text-ink-muted">
            Secrets are encrypted at rest (AES-256-GCM) and never returned by the API.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {busy ? "Saving…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
