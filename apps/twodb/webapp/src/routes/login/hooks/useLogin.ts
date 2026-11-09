import { useCallback, useState } from "react";
import { authClient } from "../../../lib/auth-client.js";

/** Business hook: passkey sign-in/sign-up. No JSX here, just state + calls. */
export function useLogin() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signInWithPasskey = useCallback(async () => {
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.passkey();
    setPending(false);
    if (err) setError(err.message ?? "Sign-in failed");
  }, []);

  const registerPasskey = useCallback(async (name: string) => {
    setPending(true);
    setError(null);
    // First-run: no session yet, so this both creates the user and the
    // passkey credential in one step via better-auth's passkey plugin.
    const { error: err } = await authClient.passkey.addPasskey({ name });
    setPending(false);
    if (err) setError(err.message ?? "Passkey registration failed");
  }, []);

  return { error, pending, signInWithPasskey, registerPasskey };
}
