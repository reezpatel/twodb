import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export interface Runner {
  id: string;
  name: string;
  hostname: string | null;
  lastSeenAt: string;
  createdAt: string;
  online: boolean;
}

export interface RunnerKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

export function useRunners() {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [terminalRunner, setTerminalRunner] = useState<Runner | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runners = useQuery({
    queryKey: ["runners"],
    queryFn: () => api<Runner[]>("/api/runners"),
  });

  const keys = useQuery({
    queryKey: ["runner-keys"],
    queryFn: () => api<RunnerKey[]>("/api/runner-keys"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["runners"] });
    void queryClient.invalidateQueries({ queryKey: ["runner-keys"] });
  };

  const createKey = useMutation({
    mutationFn: (name: string) =>
      api<{ key: string }>("/api/runner-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data) => {
      setNewKey(data.key);
      invalidate();
    },
    onError: (e) => setActionError(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api(`/api/runner-keys/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => setActionError(e.message),
  });

  const deleteRunner = useMutation({
    mutationFn: (id: string) => api(`/api/runners/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => setActionError(e.message),
  });

  return {
    runners,
    keys,
    newKey,
    setNewKey,
    terminalRunner,
    setTerminalRunner,
    actionError,
    createKey,
    revokeKey,
    deleteRunner,
  };
}
