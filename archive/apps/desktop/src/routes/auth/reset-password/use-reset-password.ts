import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useForm } from "@tanstack/react-form";
import { authClient } from "../../../lib/auth-client";

export function useResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(
    token ? null : "Invalid or missing reset token",
  );

  const form = useForm({
    defaultValues: { password: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      if (value.password !== value.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token: token!,
      });
      if (error) {
        setError(error.message ?? "Could not reset password");
      } else {
        navigate("/login");
      }
    },
  });

  return { form, error, hasToken: !!token };
}
