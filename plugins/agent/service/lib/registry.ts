import {
	providerTypeById,
	type AgentProviderType,
} from "../../shared/providers";

export type SplitConfig = {
	config: Record<string, string>;
	secretFields: Record<string, string>;
};

/**
 * Validates a user-supplied config object against the provider registry and
 * splits it into non-secret (jsonb) and secret (encrypted blob) parts.
 * Throws Error with a user-facing message on invalid input.
 */
export function splitConfig(
	provider: AgentProviderType,
	input: unknown,
	validateRequired = true,
): SplitConfig {
	if (input === undefined || input === null) {
		input = {};
	}
	if (typeof input !== "object" || Array.isArray(input)) {
		throw new Error("config must be an object");
	}
	const entries = Object.entries(input as Record<string, unknown>);
	for (const [key, value] of entries) {
		if (typeof value !== "string") {
			throw new Error(`config.${key} must be a string`);
		}
	}

	const allowed = new Map(provider.fields.map((field) => [field.key, field]));
	const config: Record<string, string> = {};
	const secretFields: Record<string, string> = {};

	for (const [key, value] of entries as [string, string][]) {
		const field = allowed.get(key);
		if (!field) {
			throw new Error(
				`config.${key} is not a known field for provider "${provider.id}"`,
			);
		}
		if (value.length === 0) continue;
		if (field.secret) secretFields[key] = value;
		else config[key] = value;
	}

	if (!validateRequired) return { config, secretFields };
	for (const field of provider.fields) {
		if (
			field.required &&
			config[field.key] === undefined &&
			secretFields[field.key] === undefined
		) {
			throw new Error(
				`config.${field.key} is required for provider "${provider.id}"`,
			);
		}
	}

	return { config, secretFields };
}

export function requireProviderType(id: unknown): AgentProviderType {
	if (typeof id !== "string" || id.length === 0) {
		throw new Error("provider is required");
	}
	// providers registered by agent-providers/* plugins own their auth UI and
	// validation; the static catalog only governs the legacy templates
	return (
		providerTypeById(id) ?? {
			id,
			label: id,
			auth: ["api_key"],
			fields: [],
			usage: { supported: false, ttlMs: 0 },
		}
	);
}
