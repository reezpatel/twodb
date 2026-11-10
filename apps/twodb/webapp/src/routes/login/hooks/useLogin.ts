import { useCallback, useState } from "react";
import { authClient } from "../../../lib/auth-client.js";

/** Business hook: passkey sign-in/sign-up. No JSX here, just state + calls. */
export function useLogin() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");

  const signInWithPasskey = useCallback(async () => {
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.passkey();
    setPending(false);
    if (err) setError(err.message ?? "Sign-in failed");
  }, []);

  const registerPasskey = useCallback(async () => {
    setPending(true);
    setError(null);
    // First-run bootstrap: no session yet — the server allows sessionless
    // registration only while the instance has zero users, creates the user
    // at verify time, and (thanks to createSession) signs us in immediately.
    const { error: err } = await authClient.passkey.addPasskey({
      name: "primary",
      createSession: true,
      fetchOptions: { body: { userName: name.trim() || "owner" } },
    } as any);
    setPending(false);
    if (err) setError(err.message ?? "Passkey registration failed");
  }, [name]);

  return { error, pending, mode, setMode, name, setName, signInWithPasskey, registerPasskey };
}
