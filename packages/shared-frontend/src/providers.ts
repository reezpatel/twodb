import { useEffect, useReducer } from "react";
import type { PluginStore } from "react-pluggable";
import {
	REQUIRED_PROVIDER_SLOTS,
	type PluginId,
	type ProviderSlot,
} from "@twodb/contracts";

interface ProviderEntry {
	owner: PluginId;
	impl: unknown;
}

interface ProviderHost {
	providers: Map<ProviderSlot, ProviderEntry>;
	subscribers: Set<() => void>;
}

const hosts = new WeakMap<PluginStore, ProviderHost>();

function getHost(store: PluginStore): ProviderHost {
	let host = hosts.get(store);
	if (!host) {
		host = { providers: new Map(), subscribers: new Set() };
		hosts.set(store, host);
	}
	return host;
}

function notify(host: ProviderHost): void {
	for (const subscriber of host.subscribers) subscriber();
}

export function registerProvider<T>(
	store: PluginStore,
	slot: ProviderSlot,
	impl: T,
	owner: PluginId,
): void {
	const host = getHost(store);
	const existing = host.providers.get(slot);
	if (existing && existing.owner !== owner) {
		throw new Error(
			`twodb: provider slot "${slot}" is already filled by "${existing.owner}"; ` +
				`"${owner}" cannot register it. Uninstall one of the two plugins.`,
		);
	}
	host.providers.set(slot, { owner, impl });
	notify(host);
}

export function unregisterProvider(
	store: PluginStore,
	slot: ProviderSlot,
	owner: PluginId,
): void {
	const host = getHost(store);
	const existing = host.providers.get(slot);
	if (existing?.owner === owner) {
		host.providers.delete(slot);
		notify(host);
	}
}

export function getProvider<T>(
	store: PluginStore,
	slot: ProviderSlot,
): T | null {
	return (getHost(store).providers.get(slot)?.impl as T | undefined) ?? null;
}

export function useProvider<T>(
	store: PluginStore,
	slot: ProviderSlot,
): T | null {
	const host = getHost(store);
	const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

	useEffect(() => {
		host.subscribers.add(forceUpdate);
		return () => {
			host.subscribers.delete(forceUpdate);
		};
	}, [host]);

	return getProvider<T>(store, slot);
}

export function assertRequiredProviders(store: PluginStore): void {
	const host = getHost(store);
	const missing = REQUIRED_PROVIDER_SLOTS.filter(
		(slot) => !host.providers.has(slot),
	);
	if (missing.length > 0) {
		throw new Error(
			`twodb: required provider slot(s) missing: ${missing.join(", ")}. ` +
				`Install a plugin that registers them.`,
		);
	}
}
