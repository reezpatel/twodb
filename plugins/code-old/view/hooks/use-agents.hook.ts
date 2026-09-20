import { useQuery } from "@tanstack/react-query";
import { codeApi, sessionAgentsQueryKey } from "../lib/api";

export type SessionAgent = {
	id: string;
	name: string;
	provider: string;
	model: string | null;
	enabled: boolean;
};

/** Agent configs available for sessions (via the code plugin's /agents). */
export function useSessionAgents() {
	return useQuery({
		queryKey: sessionAgentsQueryKey,
		queryFn: async () =>
			(await codeApi.get<{ agents: SessionAgent[] }>("/agents")).agents,
	});
}

export const agentLabel = (agent: SessionAgent): string => agent.name;
