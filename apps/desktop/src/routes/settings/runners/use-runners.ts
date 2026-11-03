import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export interface Runner {
  id: string;
  name: string;
  hostname: string | null;
  lastSeenAt: string;
  createdAt: string;
  online: boolean;
  /** AWS SSO start-app config (one per runner) — the AWS widget's login uses it. */
  awsStartUrl?: string | null;
  awsSsoRegion?: string | null;
}

export function useRunners() {
  const queryClient = useQueryClient();
  const [terminalRunner, setTerminalRunner] = useState<Runner | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runners = useQuery({
    queryKey: ["runners"],
    queryFn: () => api<Runner[]>("/api/runners"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["runners"] });
  };

  const deleteRunner = useMutation({
    mutationFn: (id: string) => api(`/api/runners/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: (e) => setActionError(e.message),
  });

  return {
    runners,
    terminalRunner,
    setTerminalRunner,
    actionError,
    deleteRunner,
  };
}
