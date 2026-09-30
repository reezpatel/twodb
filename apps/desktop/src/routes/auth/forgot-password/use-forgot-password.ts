import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { authClient } from "../../../lib/auth-client";

export function useForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message ?? "Could not send reset link");
      } else {
        setSent(true);
      }
    },
  });

  return { form, error, sent };
}
