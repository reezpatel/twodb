import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { FileJson, Loader2, LogIn } from "lucide-react";
import { api } from "../../lib/api";
import type { LlmConnection, LlmProvider } from "../../lib/llm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConnectionFormProps {
  providers: LlmProvider[];
  connection?: LlmConnection;
  onSaved: () => void;
  onCancel: () => void;
}

interface OAuthSigninConfig {
  start: string;
  poll: string;
  complete: string;
  button: string;
  site: string;
  fileHint: string;
  callbackPort: number;
}

const OAUTH_SIGNIN: Record<string, OAuthSigninConfig> = {
  "claude-code": {
    start: "/api/llm/claude-code/oauth/start",
    poll: "/api/llm/claude-code/oauth/poll",
    complete: "/api/llm/claude-code/oauth/complete",
    button: "Sign in with Claude Code",
    site: "claude.ai",
    fileHint: "~/.claude/.credentials.json",
    callbackPort: 53692,
  },
  codex: {
    start: "/api/llm/codex/oauth/start",
    poll: "/api/llm/codex/oauth/poll",
    complete: "/api/llm/codex/oauth/complete",
    button: "Sign in with Codex",
    site: "chatgpt.com",
    fileHint: "~/.codex/auth.json",
    callbackPort: 1455,
  },
};

export function ConnectionForm({ providers, connection, onSaved, onCancel }: ConnectionFormProps) {
  const editing = !!connection;
  const [providerId, setProviderId] = useState(connection?.provider ?? providers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [credNote, setCredNote] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const provider = providers.find((p) => p.id === providerId);
  const oauth = OAUTH_SIGNIN[providerId];

  const form = useForm({
    defaultValues: {
      name: connection?.name ?? "",
      config: (connection?.config ?? {}) as Record<string, string>,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        if (editing) {
          await api(`/api/llm/connections/${connection.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: value.name, config: value.config }),
          });
        } else {
          await api("/api/llm/connections", {
            method: "POST",
            body: JSON.stringify({
              provider: providerId,
              name: value.name,
              config: value.config,
            }),
          });
        }
        onSaved();
      } catch (e) {
        setError((e as Error).message);
      }
    },
  });

  /** Reads a CLI credentials file (Claude credentials.json or Codex auth.json, nested or flat) and fills the token fields. */
  const loadCredentialsFile = async (file: File) => {
    setError(null);
    setCredNote(null);
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const nested = (key: string) => (typeof parsed[key] === "object" && parsed[key] !== null ? (parsed[key] as Record<string, unknown>) : null);
      const src = nested("claudeAiOauth") ?? nested("tokens") ?? parsed;
      const str = (...keys: string[]) => keys.map((k) => src[k]).find((v): v is string => typeof v === "string" && v.length > 0) ?? "";
      const refreshToken = str("refreshToken", "refresh_token");
      const accessToken = str("accessToken", "access_token");
      const accountId = str("accountId", "account_id");
      if (!refreshToken && !accessToken) {
        setError("No refresh/access token found in that file");
        return;
      }
      if (refreshToken) form.setFieldValue("config.refresh_token", refreshToken);
      if (accessToken) form.setFieldValue("config.access_token", accessToken);
      if (accountId) form.setFieldValue("config.account_id", accountId);
      setCredNote(`Loaded ${file.name}${accessToken ? " — access token filled, refresh will keep it fresh" : ""}`);
    } catch {
      setError("That file is not valid JSON");
    }
  };

  /** Browser OAuth: sign in with the provider account; tokens land in the fields. */
  const signInOAuth = async (cfg: OAuthSigninConfig) => {
    setError(null);
    setCredNote(null);
    setSigningIn(true);
    try {
      const start = await api<{ url: string; state: string }>(cfg.start, { method: "POST", body: "{}" });
      window.open(start.url, "_blank");
      const deadline = Date.now() + 5 * 60_000;
      for (;;) {
        if (Date.now() > deadline) {
          setError("Sign-in timed out — try again");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const poll = await api<{ status: string; accessToken?: string; refreshToken?: string; accountId?: string; error?: string }>(cfg.poll, {
          method: "POST",
          body: JSON.stringify({ state: start.state }),
        });
        if (poll.status === "done") {
          if (poll.refreshToken) form.setFieldValue("config.refresh_token", poll.refreshToken);
          if (poll.accessToken) form.setFieldValue("config.access_token", poll.accessToken);
          if (poll.accountId) form.setFieldValue("config.account_id", poll.accountId);
          setCredNote("Signed in — tokens filled. Save to finish.");
          break;
        }
        if (poll.status === "error" || poll.status === "unknown") {
          setError(poll.error ?? "sign-in expired — try again");
          break;
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setSigningIn(false);
  };

  /** Firewall fallback: paste the redirected callback URL and complete by hand. */
  const usePastedCallback = async (cfg: OAuthSigninConfig) => {
    setError(null);
    setCredNote(null);
    try {
      const result = await api<{ status: string; accessToken?: string; refreshToken?: string; accountId?: string; error?: string }>(cfg.complete, {
        method: "POST",
        body: JSON.stringify({ input: callbackUrl }),
      });
      if (result.status === "done") {
        if (result.refreshToken) form.setFieldValue("config.refresh_token", result.refreshToken);
        if (result.accessToken) form.setFieldValue("config.access_token", result.accessToken);
        if (result.accountId) form.setFieldValue("config.account_id", result.accountId);
        setCallbackUrl("");
        setCredNote("Signed in via pasted callback — tokens filled. Save to finish.");
      } else {
        setError(result.error ?? `sign-in ${result.status} — check the pasted URL`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {!editing && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="provider">Provider</Label>
          <select
            id="provider"
            className="border-input bg-background rounded-md border px-3 py-2 text-sm shadow-xs focus:border-ring focus:ring-ring/50 focus:outline-none"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="conn-name">Name</Label>
            <Input
              id="conn-name"
              placeholder="e.g. Work Kimi"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              required
            />
          </div>
        )}
      </form.Field>

      {oauth && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button type="button" size="sm" className="w-fit" disabled={signingIn} onClick={() => void signInOAuth(oauth)}>
              {signingIn ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
              {signingIn ? "Waiting for browser sign-in…" : oauth.button}
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => fileRef.current?.click()}>
              <FileJson size={13} />
              Load credentials.json…
            </Button>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Browser sign-in opens {oauth.site} — each connection can use a different account. File picker reads the CLI's{" "}
            <code className="font-mono">{oauth.fileHint}</code> as a fallback.
          </p>
          <div className="flex gap-2">
            <Input
              className="h-8 flex-1 text-xs"
              placeholder={`Firewalled? Paste the http://localhost:${oauth.callbackPort}/… callback URL here`}
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" disabled={!callbackUrl.trim()} onClick={() => void usePastedCallback(oauth)}>
              Use
            </Button>
          </div>
          {credNote && <p className="text-success text-[11px]">{credNote}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadCredentialsFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {provider?.fields.map((providerField) => (
        <form.Field key={providerField.key} name={`config.${providerField.key}`}>
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`conn-${providerField.key}`}>
                {providerField.label}
                {providerField.optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
              </Label>
              <Input
                id={`conn-${providerField.key}`}
                type={providerField.secret ? "password" : "text"}
                placeholder={providerField.placeholder}
                value={field.state.value ?? ""}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required={!providerField.optional}
              />
            </div>
          )}
        </form.Field>
      ))}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {editing ? "Save" : "Add"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
