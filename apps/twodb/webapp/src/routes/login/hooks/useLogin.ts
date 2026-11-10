import { useCallback, useState } from "react";
import { authClient } from "../../../lib/auth-client.js";

/** Business hook: passkey sign-in/sign-up. No JSX here, just state + calls. */
export function useLogin() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");

  const signInWithPasskey = useCallback(async () => {
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signIn.passkey();
    setPending(false);
    if (err) setError(err.message ?? "Sign-in failed");
  }, []);

  const registerPasskey = useCallback(async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }
    setPending(true);
    setError(null);
    // First-run bootstrap: no session yet — the server allows sessionless
    // registration only while no passkey-bound user exists, creates the user
    // (superadmin) at options time, and (thanks to createSession) signs us
    // in immediately after the ceremony.
    const { error: err } = await authClient.passkey.addPasskey({
      name: "primary",
      createSession: true,
      context: trimmed, // email rides the plugin's declared context param (its query schema strips unknown keys)
    });
    setPending(false);
    if (err) setError(err.message ?? "Passkey registration failed");
  }, [email]);

  return { error, pending, mode, setMode, email, setEmail, signInWithPasskey, registerPasskey };
}
