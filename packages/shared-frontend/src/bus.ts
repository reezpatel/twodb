import type { IPlugin, PluginStore } from "react-pluggable";
import type { AppEventMap } from "@twodb/contracts";

type EventKey<Map> = keyof Map & string;

/**
 * The frontend bus. View plugins use it for facts (`emit`/`on`); the api
 * plugin mirrors backend bus events onto it, so `AppEventMap` covers both
 * local view events and server facts.
 */
export class FrontendBus<Map extends object = AppEventMap> {
	private handlers = new Map<string, Set<(payload: never) => void>>();

	emit<K extends EventKey<Map>>(event: K, payload: Map[K]): void {
		const set = this.handlers.get(event);
		if (!set) return;
		for (const handler of set) (handler as (p: Map[K]) => void)(payload);
	}

	on<K extends EventKey<Map>>(
		event: K,
		handler: (payload: Map[K]) => void,
	): () => void {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler as (payload: never) => void);
		return () => this.off(event, handler);
	}

	off<K extends EventKey<Map>>(
		event: K,
		handler: (payload: Map[K]) => void,
	): void {
		this.handlers.get(event)?.delete(handler as (payload: never) => void);
	}
}

/* The bus lives beside the PluginStore (one per store), reachable from
 * anywhere via getBus(store). */
const buses = new WeakMap<PluginStore, FrontendBus>();

export function getBus(store: PluginStore): FrontendBus {
	const bus = buses.get(store);
	if (!bus)
		throw new Error("twodb: bus plugin is not installed on this PluginStore");
	return bus;
}

/** Core plugin: creates the typed frontend bus. Install first. */
export function createBusPlugin(): IPlugin {
	return {
		pluginStore: undefined as unknown as PluginStore,
		getPluginName: () => "twodb.bus@1.0.0",
		getDependencies: () => [],
		init(store: PluginStore) {
			this.pluginStore = store;
			buses.set(store, new FrontendBus());
		},
		activate() {},
		deactivate() {},
	};
}
