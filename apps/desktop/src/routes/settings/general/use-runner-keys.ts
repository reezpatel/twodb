import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RunnerKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

/** Runner access keys — one key can connect many runners to the organization. */
export function useRunnerKeys() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);

  const keys = useQuery({ queryKey: ["runner-keys"], queryFn: () => api<RunnerKey[]>("/api/runner-keys") });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["runner-keys"] });

  const createKey = useMutation({
    mutationFn: (name: string) => api<{ key: string }>("/api/runner-keys", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (data) => {
      setNewKey(data.key);
      invalidate();
    },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api(`/api/runner-keys/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return { keys, newKey, setNewKey, createKey, revokeKey };
}
