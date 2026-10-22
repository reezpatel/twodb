import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * AWS SSO widget state for one session. The runner owns everything (token in
 * botocore's cache, selected profile in memory); this hook polls status and
 * drives login/select through the server bridge.
 */

export interface AwsWidgetStatus {
  available: boolean;
  installed?: boolean;
  ssoSession?: string | null;
  startUrl?: string | null;
  authenticated?: boolean;
  profiles?: { name: string; accountId?: string; roleName?: string }[];
  selectedProfile?: string | null;
  offline?: boolean;
  error?: string;
}

export interface AwsLoginStart {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | null;
  expiresInSeconds: number;
}

export function useAwsWidget(sessionId: string | null) {
  const queryClient = useQueryClient();
  const key = ["code", "session", sessionId, "aws"];

  const status = useQuery({
    queryKey: key,
    queryFn: () => api<AwsWidgetStatus>(`/api/code/sessions/${sessionId}/aws`),
    enabled: sessionId !== null,
    // Poll faster while a login is pending (token may land any second).
    refetchInterval: (query) => ((query.state.data as AwsWidgetStatus | undefined)?.authenticated === false ? 5_000 : 30_000),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: key });
  }, [queryClient, key]);

  const login = useMutation({
    mutationFn: () => api<AwsLoginStart>(`/api/code/sessions/${sessionId}/aws/login`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => invalidate(),
  });

  const select = useMutation({
    mutationFn: (profile: string) => api(`/api/code/sessions/${sessionId}/aws/select`, { method: "POST", body: JSON.stringify({ profile }) }),
    onSuccess: () => invalidate(),
  });

  return { status, login, select, invalidate };
}
