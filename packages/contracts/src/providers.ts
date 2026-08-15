export const PROVIDER_SLOTS = ["identity", "footer", "taskbar"] as const;

export type ProviderSlot = (typeof PROVIDER_SLOTS)[number];

export const REQUIRED_PROVIDER_SLOTS: readonly ProviderSlot[] = ["identity"];

export function isProviderSlot(value: string): value is ProviderSlot {
	return (PROVIDER_SLOTS as readonly string[]).includes(value);
}

/**
 * Contributable shell slot — every plugin may put a "Share" trigger in
 * its entity toolbar; exactly one plugin (the identity plugin's view
 * half, task 9) provides the dialog implementation. The dialog opens
 * with `{ workspaceId, entityType, entityId }` and talks only to the
 * grants API.
 */
export const SHARE_SLOT = "share" as const;
