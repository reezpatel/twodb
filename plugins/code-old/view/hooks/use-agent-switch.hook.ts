import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionDto } from "../../shared/types";
import { codeApi, sessionsQueryKey } from "../lib/api";

export type AgentSwitchMode = "continue" | "compact" | "direct" | "clear";

/**
 * Mid-chat agent/model switch. Without history the switch is immediate; with
 * a thread, the caller confirms first — "continue" keeps history, "direct"
 * starts a fresh thread, "compact" summarizes it, "clear" wipes it.
 * summarizes it on the server before switching.
 */
export function useAgentSwitch(sessionId: string, onSwitched?: () => void) {
	const queryClient = useQueryClient();
	const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: (input: { agent_id: string; mode: AgentSwitchMode }) =>
			codeApi.patch<{ session: SessionDto }>(`/sessions/${sessionId}`, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
			setPendingAgentId(null);
			onSwitched?.();
		},
	});

	const requestSwitch = (agentId: string, hasHistory: boolean) => {
		if (!agentId) return;
		if (!hasHistory) {
			mutation.mutate({ agent_id: agentId, mode: "continue" });
			return;
		}
		setPendingAgentId(agentId);
	};

	const confirm = (mode: AgentSwitchMode) => {
		if (!pendingAgentId) return;
		mutation.mutate({ agent_id: pendingAgentId, mode });
	};

	return {
		pendingAgentId,
		requestSwitch,
		confirm,
		cancel: () => setPendingAgentId(null),
		switching: mutation.isPending,
		switchError: mutation.error?.message ?? null,
	};
}
