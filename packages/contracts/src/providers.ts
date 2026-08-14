export const PROVIDER_SLOTS = ["identity", "footer", "taskbar"] as const;

export type ProviderSlot = (typeof PROVIDER_SLOTS)[number];

export const REQUIRED_PROVIDER_SLOTS: readonly ProviderSlot[] = ["identity"];

export function isProviderSlot(value: string): value is ProviderSlot {
	return (PROVIDER_SLOTS as readonly string[]).includes(value);
}
