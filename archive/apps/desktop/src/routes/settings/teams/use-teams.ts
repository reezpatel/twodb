import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";

export interface TeamsAccount {
  id: string;
  organizationId: string;
  userId: string;
  runnerId: string;
  label: string;
  email: string | null;
  enabled: boolean;
  /** idle | starting | running | auth_required | error | runner_offline */
  status: string;
  lastError: string | null;
  lastEventAt: string | null;
  createdAt: string;
  runnerOnline: boolean;
}

export function useTeamsAccounts() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teams-accounts"] });

  const accounts = useQuery({
    queryKey: ["teams-accounts"],
    queryFn: () => api<TeamsAccount[]>("/api/teams/accounts"),
    refetchInterval: 10_000,
  });

  const create = useMutation({
    mutationFn: (body: { label: string; runnerId: string; email?: string }) =>
      api<TeamsAccount>("/api/teams/accounts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; label?: string; email?: string; enabled?: boolean; runnerId?: string }) =>
      api<TeamsAccount>(`/api/teams/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/teams/accounts/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const start = useMutation({
    mutationFn: (id: string) => api(`/api/teams/accounts/${id}/start`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const stop = useMutation({
    mutationFn: (id: string) => api(`/api/teams/accounts/${id}/stop`, { method: "POST" }),
    onSuccess: invalidate,
  });

  return { accounts, create, update, remove, start, stop };
}
