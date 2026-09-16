import type { ComponentType } from "react";

export type ProviderConfiguratorProps = {
	onNewAuth: (auth: Record<string, unknown>) => void;
};

export type ProviderConfiguratorEntry = {
	providerId: string;
	label: string;
	usage?: boolean;
	models?: { id: string; label: string }[];
	component: ComponentType<ProviderConfiguratorProps>;
};

const entries = new Map<string, ProviderConfiguratorEntry>();

export function registerProviderConfigurator(
	entry: ProviderConfiguratorEntry,
): void {
	entries.set(entry.providerId, entry);
}

export function getProviderConfigurators(): ProviderConfiguratorEntry[] {
	return [...entries.values()];
}

export function getProviderConfigurator(
	providerId: string,
): ProviderConfiguratorEntry | undefined {
	return entries.get(providerId);
}
