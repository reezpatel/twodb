import { Button } from "@twodb/blocks";
import { useAuthorize } from "./hooks/useAuthorize.js";

/** "Login with TwoDB" consent step — only calls its holding hook and renders. */
export function Authorize() {
  const { target, email, invalid, pending, error, approve, cancel } = useAuthorize();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-outline bg-card p-8 text-ink">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">Sign in to an app</h1>
        {invalid ? (
          <p className="text-sm text-red-600">{invalid}</p>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              <span className="font-mono break-all text-ink">{target}</span> wants to sign you in as{" "}
              <span className="font-medium text-ink">{email}</span>.
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button className="flex-1" disabled={pending} onClick={() => void approve()}>
                {pending ? "Signing in…" : "Continue"}
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
