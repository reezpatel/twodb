import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@twodb/blocks";
import type { Connection, ProviderSpec } from "../../../lib/tworoute-client.js";
import type { Space } from "../../connections/hooks/useConnections.js";

export interface ConnectionFormValues {
  spaceIds: string[];
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  config?: Record<string, string>;
}

export type OauthTokens = { accessToken: string; refreshToken: string; accountId?: string | null };
export type OauthRunner = (provider: "claude-code" | "codex") => Promise<OauthTokens | null>;
export type OauthCompleter = (provider: "claude-code" | "codex", input: string) => Promise<OauthTokens>;

/**
 * Shared add/edit connection dialog — one dumb component, two modes. Add:
 * everything defaults from the catalog. Edit: prefills from the connection,
 * secret fields start blank ("leave empty to keep"), and only changed fields
 * ship in the PATCH.
 */
export function ConnectionDialog({
  spaces,
  providers,
  busy,
  oauthBusy,
  mode,
  connection,
  open,
  onOpenChange,
  onSubmit,
  onRunOauth,
  onCompleteOauth,
  trigger,
}: {
  spaces: Space[];
  providers: ProviderSpec[];
  busy: boolean;
  oauthBusy: boolean;
  mode: "add" | "edit";
  connection?: Connection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ConnectionFormValues) => void;
  onRunOauth: OauthRunner;
  onCompleteOauth: OauthCompleter;
  trigger?: React.ReactNode;
}) {
  const [providerId, setProviderId] = useState(connection?.provider ?? "anthropic");
  const [spaceIds, setSpaceIds] = useState<string[]>(
    connection ? (connection.spaceIds?.length ? connection.spaceIds : [connection.spaceId]) : spaces[0] ? [spaces[0].id] : [],
  );
  const [callbackUrl, setCallbackUrl] = useState("");
  /** Bumped on every sign-in attempt so a superseded poll loop can't clobber newer results. */
  const oauthRun = useRef(0);
  const [name, setName] = useState(connection?.name ?? "");
  const [defaultModel, setDefaultModel] = useState(connection?.defaultModel ?? "");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [oauthState, setOauthState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  const [oauthError, setOauthError] = useState<string | null>(null);

  const spec = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId]);
  const isOauth = spec?.auth === "claude-oauth" || spec?.auth === "codex-oauth";

  // Prefill non-secret, known fields when switching to edit mode / provider.
  useEffect(() => {
    if (mode === "edit" && connection) {
      setProviderId(connection.provider);
      setSpaceIds(connection.spaceIds?.length ? connection.spaceIds : [connection.spaceId]);
      setName(connection.name);
      setDefaultModel(connection.defaultModel ?? "");
      setFieldValues((v) => ({ ...v, baseUrl: connection.baseUrl }));
      setOauthState("idle");
      setOauthError(null);
    }
  }, [mode, connection]);

  useEffect(() => {
    if (mode === "add" && spaceIds.length === 0 && spaces[0]) setSpaceIds([spaces[0].id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces, mode]);

  useEffect(() => {
    if (mode === "add") {
      if (spec?.defaultBaseUrl) setFieldValues((v) => ({ ...v, baseUrl: spec.defaultBaseUrl! }));
      if (spec?.models[0]) setDefaultModel((m) => m || spec.models[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, providers, mode]);

  const applyOauthTokens = (result: OauthTokens) => {
    setFieldValues((v) => ({
      ...v,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      ...(result.accountId ? { accountId: String(result.accountId) } : {}),
    }));
    setOauthState("done");
    setOauthError(null);
    setCallbackUrl("");
  };

  const oauthProvider = providerId as "claude-code" | "codex";

  const startOauth = async () => {
    const run = ++oauthRun.current;
    setOauthState("waiting");
    setOauthError(null);
    try {
      const result = await onRunOauth(oauthProvider);
      if (run !== oauthRun.current) return;
      if (result) applyOauthTokens(result);
      else {
        setOauthState("error");
        setOauthError("Sign-in didn't complete (timed out waiting for the callback). Paste the callback URL below instead.");
      }
    } catch (e) {
      if (run !== oauthRun.current) return;
      setOauthState("error");
      setOauthError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Firewall/remote fallback: paste the redirected (failed-to-load) callback URL to finish by hand. */
  const submitCallback = async () => {
    oauthRun.current++; // supersede any running poll
    setOauthError(null);
    try {
      applyOauthTokens(await onCompleteOauth(oauthProvider, callbackUrl));
    } catch (e) {
      setOauthState("error");
      setOauthError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleSpace = (id: string) => setSpaceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const requiredFieldsOk = (spec?.fields ?? []).filter((f) => !f.optional && mode === "add").every((f) => (fieldValues[f.key] ?? "").trim().length > 0);
  const canSubmit = spaceIds.length > 0 && name.trim() && spec && (mode === "edit" || requiredFieldsOk) && !busy && (!isOauth || oauthState === "done" || mode === "edit");

  const submit = () => {
    const config: Record<string, string> = {};
    for (const f of spec?.fields ?? []) {
      const val = (fieldValues[f.key] ?? "").trim();
      if (val && f.key !== "apiKey" && f.key !== "baseUrl") config[f.key] = val;
    }
    const values: ConnectionFormValues = {
      spaceIds,
      name: name.trim(),
      provider: providerId,
      baseUrl: (fieldValues.baseUrl ?? "").trim() || spec?.defaultBaseUrl,
      apiKey: (fieldValues.apiKey ?? "").trim() || undefined,
      defaultModel: defaultModel.trim() || undefined,
      config: Object.keys(config).length ? config : undefined,
    };
    onSubmit(values);
    if (mode === "add") {
      setName("");
      setFieldValues({});
      setDefaultModel("");
      setOauthState("idle");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogTitle className="sr-only">{mode === "add" ? "Add connection" : `Edit ${connection?.name}`}</DialogTitle>
        <div className="grid gap-3">
          {mode === "add" ? (
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
          ) : (
            <p className="text-[13px] text-ink-muted">
              Editing <span className="font-semibold text-ink">{connection?.name}</span> — leave secret fields empty to keep them.
            </p>
          )}
          <div className="grid gap-1.5">
            <Label>
              Spaces
              <span className="text-ink-muted"> (select one or more)</span>
            </Label>
            <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-[6px] border border-outline bg-paper p-2">
              {spaces.length === 0 ? <span className="text-[13px] text-ink-muted">No spaces available</span> : null}
              {spaces.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                  <input type="checkbox" checked={spaceIds.includes(s.id)} onChange={() => toggleSpace(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
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
              {oauthState !== "done" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="conn-callback">
                    Or paste the callback URL
                    <span className="text-ink-muted"> (if the browser couldn't reach localhost)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="conn-callback"
                      value={callbackUrl}
                      onChange={(e) => setCallbackUrl(e.target.value)}
                      placeholder="http://localhost:…/callback?code=…&state=…"
                    />
                    <Button size="sm" variant="ghost" disabled={!callbackUrl.trim()} onClick={() => void submitCallback()}>
                      Use URL
                    </Button>
                  </div>
                </div>
              ) : null}
              {oauthError ? <p className="text-[13px] text-destructive">{oauthError}</p> : null}
            </div>
          ) : null}

          {(spec?.fields ?? []).map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`conn-${f.key}`}>
                {f.label}
                {f.optional ? <span className="text-ink-muted"> (optional)</span> : null}
                {mode === "edit" && f.secret ? <span className="text-ink-muted"> (leave empty to keep)</span> : null}
              </Label>
              <Input
                id={`conn-${f.key}`}
                type={f.secret ? "password" : "text"}
                value={fieldValues[f.key] ?? ""}
                placeholder={mode === "edit" && f.secret ? "••••••••" : f.placeholder}
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
          <p className="text-[13px] text-ink-muted">Secrets are encrypted at rest (AES-256-GCM) and never returned by the API.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {busy ? "Saving…" : mode === "add" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
