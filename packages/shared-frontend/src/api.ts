import { isPluginId } from "@twodb/contracts";

export class ApiError extends Error {
	constructor(
		public status: number,
		public body: string,
	) {
		super(`API request failed (${status}): ${body}`);
	}
}

export class ApiClient {
	constructor(private pluginId: string) {
		if (!isPluginId(pluginId)) {
			throw new Error(`PluginApi: invalid plugin id "${pluginId}"`);
		}
	}

	private url(path: string): string {
		return `/api/v1/${this.pluginId}${path}`;
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
	del(path: string, body?: unknown): Promise<void> {
		return this.request<void>("DELETE", path, body);
	}
}
