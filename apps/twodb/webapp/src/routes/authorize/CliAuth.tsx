import { Button } from "@twodb/blocks";
import { useCliAuth } from "./hooks/useCliAuth.js";

/**
 * `twodb auth <url>` consent step — the CLI opened the browser here with a
 * PKCE challenge + localhost redirect; approving mints a workspace API key
 * scoped to this user and hands it only to the loopback listener.
 */
export function CliAuth() {
  const { keyName, email, invalid, pending, error, approve, cancel } = useCliAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-outline bg-card p-8 text-ink">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">twodb CLI access</h1>
        {invalid ? (
          <p className="text-sm text-red-600">{invalid}</p>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              The <span className="font-mono text-ink">twodb</span> CLI on this machine wants to authenticate as{" "}
              <span className="font-medium text-ink">{email}</span> and create the API key{" "}
              <span className="font-mono text-ink">{keyName}</span>.
            </p>
            <p className="text-xs text-ink-muted">The key is handed only to the local listener on 127.0.0.1 and never shown again.</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button className="flex-1" disabled={pending} onClick={() => void approve()}>
                {pending ? "Authorizing…" : "Allow"}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={cancel}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
