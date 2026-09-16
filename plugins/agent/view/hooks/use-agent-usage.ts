import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLUGIN_ID } from "../../shared/constants";
import type { AgentUsageDto, AgentUsageSnapshotDto } from "../../shared/types";
import { agentApi, agentsQueryKey, usageSummaryQueryKey } from "../lib/api";

const usageQueryKey = (agentId: string) =>
	[PLUGIN_ID, "agents", agentId, "usage"] as const;

export function useAgentUsage(agentId: string | null) {
	return useQuery({
		queryKey: agentId ? usageQueryKey(agentId) : [PLUGIN_ID, "usage", "none"],
		enabled: agentId !== null,
		queryFn: async () => {
			const data = await agentApi.get<{ usage: AgentUsageDto }>(
				`/agents/${agentId}/usage`,
			);
			return data.usage;
		},
	});
}

export function useAgentsUsageSummary() {
	return useQuery({
		queryKey: usageSummaryQueryKey,
		queryFn: async () => {
			const data = await agentApi.get<{
				summaries: Record<string, AgentUsageSnapshotDto[]>;
			}>("/agents/usage/summary");
			return data.summaries;
		},
	});
}

export function useRefreshAgentUsage(agentId: string | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			agentApi.post<{ usage: AgentUsageDto }>(
				`/agents/${agentId}/usage/refresh`,
				{},
			),
		onSuccess: () => {
			if (agentId) {
				queryClient.invalidateQueries({ queryKey: usageQueryKey(agentId) });
			}
			queryClient.invalidateQueries({ queryKey: agentsQueryKey });
			queryClient.invalidateQueries({ queryKey: usageSummaryQueryKey });
		},
	});
}
