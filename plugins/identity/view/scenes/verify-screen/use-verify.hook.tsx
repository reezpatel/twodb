import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useIdentity, setIdentitySnapshot } from "@twodb/shared-frontend";
import { apiClient } from "../../utils";
import { useTwoDbIdentity } from "../../provider/IdentityProvider";

export function useVerify() {
  const { refetch } = useTwoDbIdentity();

  const identity = useIdentity();
  const [sent, setSent] = useState(false);

  const requestCode = useMutation({
    mutationFn: async () => {
      await apiClient.post("/auth/verify", {});
    },
    onSuccess: () => setSent(true),
    onError: () => setSent(false),
  });

  const confirm = useMutation({
    mutationFn: async (code: string) => {
      await apiClient.post("/auth/verify/confirm", { code: code.trim() });
      refetch();
    },
  });

  const error = requestCode.error?.message ?? confirm.error?.message ?? null;

  return {
    userName: identity.userName,
    sent,
    requestCode,
    confirm,
    error,
  };
}
