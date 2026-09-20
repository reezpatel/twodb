import type { ComponentType } from "react";

export type LlmProviderSetupProps = {
  connectionId: string;
  config: unknown;
  setConfig: (data: unknown) => Promise<{ success: boolean; errors?: string[] }>;
};

// View bundles externalize @twodb/shared-frontend onto the shell's single
// optimized copy (vite facade), so every plugin's view lands on this one
// module instance and the registry is shared across bundles.
const setups = new Map<string, ComponentType<LlmProviderSetupProps>>();

export function registerLlmProviderSetup(providerId: string, component: ComponentType<LlmProviderSetupProps>): void {
  setups.set(providerId, component);
}

export function getLlmProviderSetup(providerId: string): ComponentType<LlmProviderSetupProps> | null {
  return setups.get(providerId) ?? null;
}
