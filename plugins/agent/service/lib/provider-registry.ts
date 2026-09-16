import type {
	AgentProviderFactory,
	AgentProviderRegistry,
} from "@twodb/contracts";

export function createAgentProviderRegistry(): AgentProviderRegistry {
	const factories = new Map<string, AgentProviderFactory>();
	return {
		register: (providerId, factory) => {
			factories.set(providerId, factory);
		},
		get: (providerId) => factories.get(providerId),
	};
}
