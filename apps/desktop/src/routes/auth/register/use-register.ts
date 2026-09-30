import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { authClient } from "../../../lib/auth-client";
import { api } from "../../../lib/api";

export function useRegister() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => api<{ signUpEnabled: boolean }>("/api/public-settings"),
    retry: false,
  });
  const signUpEnabled = settings.data?.signUpEnabled ?? true;

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      if (value.password !== value.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      const { error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
      });
      if (error) {
        setError(error.message ?? "Registration failed");
      } else {
        navigate("/orgs");
      }
    },
  });

  return { form, error, signUpEnabled, settingsLoading: settings.isPending };
}
