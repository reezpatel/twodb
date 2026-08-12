import type { IPlugin, PluginStore } from "react-pluggable";
import {
	apiPrefix,
	isPluginId,
	type BackendEventMap,
	type PluginId,
} from "@twodb/contracts";
import { getBus } from "./bus";

function defaultBaseUrl(): string {
	// Vite injects import.meta.env; guard so this module also runs in tests.
	const env = (import.meta as { env?: Record<string, string | undefined> }).env;
	return env?.VITE_API_URL ?? "http://localhost:3001";
}

export class ApiError extends Error {
	constructor(
		public status: number,
		body: string,
	) {
		super(`API request failed (${status}): ${body}`);
	}
}

/** API handle scoped to one plugin: paths are plugin-local (`/notes/:id`). */
export class PluginApi {
	constructor(
		private baseUrl: string,
		private pluginId: PluginId,
	) {
		if (!isPluginId(pluginId)) {
			throw new Error(`PluginApi: invalid plugin id "${pluginId}"`);
		}
	}

	private url(path: string): string {
		return `${this.baseUrl}${apiPrefix(this.pluginId)}${path}`;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> {
		const res = await fetch(this.url(path), {
			method,
			headers:
				body === undefined ? undefined : { "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!res.ok) throw new ApiError(res.status, await res.text());
		if (res.status === 204) return undefined as T;
		return (await res.json()) as T;
	}

	get<T>(path: string): Promise<T> {
		return this.request<T>("GET", path);
	}
	post<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>("POST", path, body);
	}
	patch<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>("PATCH", path, body);
	}
	del(path: string): Promise<void> {
		return this.request<void>("DELETE", path);
	}
}

export class ApiClient {
	constructor(private baseUrl: string) {}

	/** Scope the client to a plugin: urls become `/api/v1/<plugin_id><path>`. */
	for(pluginId: PluginId): PluginApi {
		return new PluginApi(this.baseUrl, pluginId);
	}

	/**
	 * Realtime bridge: subscribe once to the host's SSE endpoint and re-emit
	 * every backend bus event onto the frontend bus. Returns a disconnect fn.
	 */
	connectEvents(store: PluginStore): () => void {
		const source = new EventSource(`${this.baseUrl}/api/v1/events`);
		source.onmessage = (message) => {
			const { event, payload } = JSON.parse(message.data) as {
				event: keyof BackendEventMap & string;
				payload: BackendEventMap[keyof BackendEventMap];
			};
			getBus(store).emit(event, payload);
		};
		return () => source.close();
	}
}

const clients = new WeakMap<PluginStore, ApiClient>();

export function getApi(store: PluginStore): ApiClient {
	const client = clients.get(store);
	if (!client)
		throw new Error("twodb: api plugin is not installed on this PluginStore");
	return client;
}

/** Core plugin: typed /api client + the SSE bridge onto the frontend bus. */
export function createApiPlugin(options?: { baseUrl?: string }): IPlugin {
	let disconnect: (() => void) | undefined;
	return {
		pluginStore: undefined as unknown as PluginStore,
		getPluginName: () => "twodb.api@1.0.0",
		getDependencies: () => ["twodb.bus@1.0.0"],
		init(store: PluginStore) {
			this.pluginStore = store;
			clients.set(store, new ApiClient(options?.baseUrl ?? defaultBaseUrl()));
		},
		activate() {
			disconnect = getApi(this.pluginStore).connectEvents(this.pluginStore);
		},
		deactivate() {
			disconnect?.();
		},
	};
}
