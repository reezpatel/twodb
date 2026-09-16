import type { AgentProviderRegistry } from "@twodb/contracts";
import type { AgentModel, AgentProvider } from "@twodb/shared-backend";
import type { AgentSecretPayload } from "../lib/crypto";

export type RuntimeProvider = {
	// biome-ignore lint: provider plugins own their credential shapes
	provider: AgentProvider<any, any>;
	model: AgentModel;
};

export async function buildRuntimeProvider(
	registry: AgentProviderRegistry,
	input: { provider: string; model: string; config: Record<string, string> },
	secret: AgentSecretPayload | null,
): Promise<RuntimeProvider> {
	const factory = registry.get(input.provider);
	if (!factory) {
		throw new Error(
			`provider "${input.provider}" cannot run threads yet (no provider plugin registered)`,
		);
	}
	if (!secret?.api_key) {
		throw new Error("agent has no api key configured");
	}

	const built = (await factory({
		apiKey: secret.api_key,
		fields: secret.fields ?? {},
		config: input.config,
		// biome-ignore lint: registry factories return unknown by design
	})) as AgentProvider<any, any>;
	if (typeof built?.api?.completion !== "function") {
		throw new Error(
			`provider "${input.provider}" did not return an AgentProvider`,
		);
	}

	const model = built.models.find((entry) => entry.id === input.model);
	if (!model) {
		throw new Error(
			`unknown model "${input.model}" for provider "${input.provider}"`,
		);
	}

	return { provider: built, model };
}
