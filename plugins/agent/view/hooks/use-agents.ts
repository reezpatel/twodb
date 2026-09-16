import { useQuery } from "@tanstack/react-query";
import type { AgentDto } from "../../shared/types";
import { agentApi, agentsQueryKey } from "../lib/api";

export function useAgents() {
	return useQuery({
		queryKey: agentsQueryKey,
		queryFn: async () => {
			const data = await agentApi.get<{ agents: AgentDto[] }>("/agents");
			return data.agents;
		},
	});
}
