import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { authClient } from "../../../lib/auth-client.js";

/** Business hook for "Login with TwoDB": reads the request from the URL, asks the control plane for a code, bounces back. */
export function useAuthorize() {
  const [params] = useSearchParams();
  const { data: session } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const state = params.get("state") ?? undefined;

  const target = useMemo(() => {
    try {
      return new URL(redirectUri).origin;
    } catch {
      return null;
    }
  }, [redirectUri]);

  const invalid = !target || !codeChallenge ? "This sign-in link is missing its redirect or PKCE challenge." : null;

  const approve = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/registry/oauth/authorize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirectUri, codeChallenge, state }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!res.ok || !body.redirectTo) throw new Error(body.error ?? `request failed (${res.status})`);
      window.location.assign(body.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }, [redirectUri, codeChallenge, state]);

  const cancel = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }, []);

  return { target, email: session?.user.email ?? null, invalid, pending, error, approve, cancel };
}
