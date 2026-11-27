import { useAuthorize } from "./hooks/useAuthorize.js";
import { ConsentCard } from "./partials/ConsentCard.js";

/** "Login with TwoDB" consent step — only calls its holding hook and renders. */
export function Authorize() {
  const { target, email, invalid, pending, error, approve, cancel } = useAuthorize();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      {invalid || !target ? (
        <div className="w-full max-w-sm rounded-2xl border border-outline bg-card p-8 text-ink shadow-lg">
          <h1 className="text-lg font-medium">Sign in to an app</h1>
          <p role="alert" className="mt-3 text-sm text-red-600">
            {invalid ?? "This sign-in link is invalid."}
          </p>
        </div>
      ) : (
        <ConsentCard
          appName={new URL(target).host}
          target={target}
          email={email ?? ""}
          error={error}
          pending={pending}
          onApprove={() => void approve()}
          onDeny={cancel}
        />
      )}
    </div>
  );
}
