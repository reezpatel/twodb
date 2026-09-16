import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AgentDto, AgentVerifyResultDto } from "../../shared/types";
import { agentApi, agentsQueryKey, usageSummaryQueryKey } from "../lib/api";

export type AgentUpsertInput = {
	name?: string;
	description?: string | null;
	provider?: string;
	api_key?: string;
	config?: Record<string, string>;
	model?: string | null;
	enabled?: boolean;
};

export type AgentVerifyInput = {
	provider: string;
	api_key?: string;
	config?: Record<string, string>;
	agent_id?: string;
};

export function useAgentMutations() {
	const queryClient = useQueryClient();
	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: agentsQueryKey });
		queryClient.invalidateQueries({ queryKey: usageSummaryQueryKey });
	};

	const create = useMutation({
		mutationFn: (input: AgentUpsertInput) =>
			agentApi.post<{ agent: AgentDto }>("/agents", input),
		onSuccess: invalidate,
	});

	const update = useMutation({
		mutationFn: ({ id, ...input }: AgentUpsertInput & { id: string }) =>
			agentApi.patch<{ agent: AgentDto }>(`/agents/${id}`, input),
		onSuccess: invalidate,
	});

	const remove = useMutation({
		mutationFn: (id: string) => agentApi.del(`/agents/${id}`),
		onSuccess: invalidate,
	});

	const verify = useMutation({
		mutationFn: (input: AgentVerifyInput) =>
			agentApi.post<AgentVerifyResultDto>("/agents/verify", input),
	});

	return { create, update, remove, verify };
}
