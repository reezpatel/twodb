export type AdminSessionState = {
	authenticated: boolean;
	bootstrapRequired: boolean;
};

export type Passkey = {
	id: string;
	name: string;
	transports: string | null;
	created_at: string;
	last_used_at: string | null;
};

export type InstanceInfo = {
	id: string;
	name: string;
	logo: string | null;
	created_at: string;
};

export type PluginEntry = {
	identifier: string;
	name: string | null;
	extracted_path: string | null;
	version: string | null;
	provides: string;
	manifest: string | null;
	config: string | null;
	created_at: string;
	updated_at: string;
};

export type PluginTemplateEntry = Omit<PluginEntry, "manifest" | "config">;

export class AdminApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export async function adminFetch<T>(
	path: string,
	options?: { method?: string; body?: unknown },
): Promise<T> {
	const res = await fetch(`/api/admin${path}`, {
		method: options?.method ?? "GET",
		headers:
			options?.body === undefined
				? undefined
				: { "content-type": "application/json" },
		body:
			options?.body === undefined ? undefined : JSON.stringify(options.body),
	});
	if (!res.ok) {
		let code = "request_failed";
		let message = `Admin request failed (${res.status})`;
		try {
			const body = (await res.json()) as { error?: string; message?: string };
			code = body.error ?? code;
			message = body.message ?? message;
		} catch {
			// non-json error body — keep defaults
		}
		throw new AdminApiError(res.status, code, message);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}
