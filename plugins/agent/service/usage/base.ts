export type UsageWindowType =
	| "hourly"
	| "5h"
	| "daily"
	| "weekly"
	| "monthly"
	| "balance";
export type UsageUnit = "%" | "Tk" | "$";

export type UsageSnapshot = {
	type: UsageWindowType;
	group: string;
	total: number;
	used: number;
	unit: UsageUnit;
	resetIso: string;
};

/**
 * Decrypted credentials for one agent row: the api key plus the secret
 * config fields (oauth tokens, cookies, ...).
 */
export type UsageCredentials = {
	apiKey?: string;
	fields: Record<string, string>;
};

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Base for usage fetchers, ported from reezpatel/llm-monitor
 * (workbench/llm-monitor/src/providers/provider.ts) — stripped of the
 * env/file secret indirection; credentials come from the agent row.
 */
export abstract class UsageProvider {
	private secretUpdates: Record<string, string> | null = null;

	constructor(protected readonly creds: UsageCredentials) {}

	abstract collect(): Promise<UsageSnapshot[]>;

	/**
	 * Secret-field updates produced during collection — e.g. OAuth tokens
	 * rotated by a refresh. Callers must persist them into the encrypted
	 * blob after the run, even when the usage fetch itself failed: some
	 * auth servers (OpenAI) rotate one-shot, so a dropped rotation
	 * invalidates the stored credential.
	 */
	protected setSecretUpdates(fields: Record<string, string>): void {
		this.secretUpdates = fields;
	}

	takeSecretUpdates(): Record<string, string> | null {
		const updates = this.secretUpdates;
		this.secretUpdates = null;
		return updates;
	}

	protected requireApiKey(label: string): string {
		if (!this.creds.apiKey) {
			throw new Error(`${label} requires an api key`);
		}
		return this.creds.apiKey;
	}

	protected requireField(key: string, label: string): string {
		const value = this.creds.fields[key];
		if (!value) {
			throw new Error(`${label} requires config.${key}`);
		}
		return value;
	}

	protected optionalField(key: string): string | undefined {
		const value = this.creds.fields[key];
		return value && value.trim() ? value : undefined;
	}

	protected async fetchWithTimeout(
		url: string,
		init: RequestInit,
		timeoutMs = REQUEST_TIMEOUT_MS,
	): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			return await fetch(url, { ...init, signal: controller.signal });
		} finally {
			clearTimeout(timeout);
		}
	}

	protected parseJson(text: string, label: string): unknown {
		try {
			return JSON.parse(text);
		} catch {
			throw new Error(`${label} returned invalid JSON`);
		}
	}

	protected sanitizeErrorMessage(text: string, maxLength = 120): string {
		const sanitized = text
			.replace(/[\u0000-\u001f\u007f]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return (sanitized || "unknown").slice(0, maxLength);
	}

	protected clampPercent(value: number): number {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(100, value));
	}

	protected resetIsoFromNowSeconds(seconds: number): string | undefined {
		if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
		return new Date(Date.now() + Math.round(seconds * 1000)).toISOString();
	}

	protected resetIsoFromMs(ms: number | undefined): string | undefined {
		if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
			return undefined;
		}
		return new Date(Math.round(ms)).toISOString();
	}

	protected asRecord(value: unknown): Record<string, unknown> | null {
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	}

	protected getNumberField(
		record: Record<string, unknown>,
		keys: string[],
	): number | undefined {
		for (const key of keys) {
			const value = record[key];
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (typeof value === "string" && value.trim()) {
				const parsed = Number(value);
				if (Number.isFinite(parsed)) return parsed;
			}
		}
		return undefined;
	}

	protected getStringField(
		record: Record<string, unknown>,
		keys: string[],
	): string | undefined {
		for (const key of keys) {
			const value = record[key];
			if (typeof value === "string" && value.trim()) return value.trim();
		}
		return undefined;
	}
}
