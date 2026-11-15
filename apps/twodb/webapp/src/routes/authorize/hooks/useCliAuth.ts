import { useCallback, useState } from "react";
import { useSearchParams } from "react-router";
import { authClient } from "../../../lib/auth-client.js";

/**
 * Business hook for `twodb auth`: reads the CLI's request from the URL
 * (code_challenge, loopback redirect_uri, key name), asks the control plane
 * to mint a one-time code, and bounces the browser back to the CLI's
 * localhost listener.
 */
export function useCliAuth() {
  const [params] = useSearchParams();
  const { data: session } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const keyName = (params.get("name") ?? "twodb-cli").slice(0, 100);

  const invalid = !redirectUri || !codeChallenge ? "This CLI sign-in link is missing its redirect or PKCE challenge." : null;

  const approve = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/cli/authorize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirectUri, codeChallenge, name: keyName }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!res.ok || !body.redirectTo) throw new Error(body.error ?? `request failed (${res.status})`);
      window.location.assign(body.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }, [redirectUri, codeChallenge, keyName]);

  const cancel = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }, []);

  return { keyName, email: session?.user.email ?? null, invalid, pending, error, approve, cancel };
}
