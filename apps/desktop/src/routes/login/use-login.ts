import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "@tanstack/react-form";
import { authClient } from "../../lib/auth-client";

export function useLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setError(error.message ?? "Sign in failed");
      } else {
        navigate("/orgs");
      }
    },
  });

  const signInWithPasskey = async () => {
    setError(null);
    const { error } = await authClient.signIn.passkey();
    if (error) {
      setError(error.message ?? "Passkey sign-in failed");
    } else {
      navigate("/orgs");
    }
  };

  return { form, error, signInWithPasskey };
}
