import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { authRepo } from "../../lib/api";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useSignin(onDone: () => void) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signin = async () => {
    const normalized = email.trim().toLowerCase();
    if (!emailRe.test(normalized)) {
      setError("Enter a valid email address");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const loginOptions = await authRepo.loginOptions(normalized);
      if (loginOptions.allowCredentials && loginOptions.allowCredentials.length > 0) {
        const response = await startAuthentication({ optionsJSON: loginOptions });
        await authRepo.loginVerify(response);
      } else {
        const registerOptions = await authRepo.registerOptions(normalized);
        const response = await startRegistration({ optionsJSON: registerOptions });
        await authRepo.registerVerify(response, normalized);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed — try again");
    } finally {
      setPending(false);
    }
  };

  return { email, setEmail, signin, pending, error };
}
