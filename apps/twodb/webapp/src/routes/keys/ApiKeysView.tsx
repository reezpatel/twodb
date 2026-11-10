import { useApiKeys } from "./hooks/useApiKeys.js";
import { CreateKeyDialog, KeyRow, RawKeyBanner } from "./partials/ApiKeysPartials.js";

/** Only calls its holding hook and renders partials. */
export function ApiKeysView() {
  const { keys, loading, busy, error, freshRawKey, dismissRawKey, create, revoke } = useApiKeys();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">API keys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace keys for the <code className="font-mono text-xs">x-api-key</code> header on gateway calls.
          </p>
        </div>
        <CreateKeyDialog busy={busy} onCreate={create} />
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {freshRawKey ? (
        <div className="mt-6">
          <RawKeyBanner rawKey={freshRawKey} onDismiss={dismissRawKey} />
        </div>
      ) : null}

      {loading ? (
        <p className="mt-10 text-center text-muted-foreground">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="mt-8 rounded-[10px] border border-dashed border-outline bg-stone/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No API keys yet — generate one to call the gateway from scripts and CLIs.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[10px] border border-outline bg-paper">
          {keys.map((k) => (
            <KeyRow key={k.id} k={k} busy={busy} onRevoke={() => void revoke(k.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
