import { UsageProvider, type UsageSnapshot } from "./base";

const KIMI_USAGE_URL = "https://api.kimi.com/coding/v1/usages";
const USER_AGENT = "twodb-agent/1.0";

type KimiWindow = {
	label: string;
	used: number;
	limit: number;
	resetIso?: string;
};

/** Ported from llm-monitor's kimi provider (api-key usages endpoint). */
export class KimiUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const apiKey = this.requireApiKey("Kimi usage");
		const response = await this.fetchWithTimeout(KIMI_USAGE_URL, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"User-Agent": USER_AGENT,
				Accept: "application/json",
			},
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Kimi API error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}

		const payload = this.asRecord(this.parseJson(text, "Kimi usage")) ?? {};
		const windows = this.parseWindows(payload);
		if (!windows.length) {
			const keys = Object.keys(payload).join(", ") || "(empty)";
			throw new Error(
				`Unexpected Kimi usage response structure (keys: ${keys})`,
			);
		}
		return windows.map((window) => this.toSnapshot(window));
	}

	private parseWindows(payload: Record<string, unknown>): KimiWindow[] {
		const data = this.asRecord(payload["data"]);
		const usage = data?.["usage"] ?? payload["usage"];
		const limits = data?.["limits"] ?? payload["limits"];
		const windows: KimiWindow[] = [];

		if (this.asRecord(usage)) {
			const row = this.toWindow(this.asRecord(usage)!, "Weekly limit");
			if (row) windows.push(row);
		}

		if (Array.isArray(limits)) {
			for (let index = 0; index < limits.length; index++) {
				const item = this.asRecord(limits[index]);
				if (!item) continue;
				const detail = this.asRecord(item["detail"]) ?? item;
				const window = this.asRecord(item["window"]) ?? {};
				const label = this.buildLimitLabel(item, detail, window, index);
				const row = this.toWindow(detail, label);
				if (row) windows.push(row);
			}
		}

		return windows;
	}

	private toWindow(
		data: Record<string, unknown>,
		defaultLabel: string,
	): KimiWindow | undefined {
		const limit = this.getNumberField(data, ["limit"]);
		let used = this.getNumberField(data, ["used"]);
		if (used === undefined) {
			const remaining = this.getNumberField(data, ["remaining"]);
			if (remaining !== undefined && limit !== undefined) {
				used = limit - remaining;
			}
		}
		if (used === undefined && limit === undefined) return undefined;

		return {
			label: this.getStringField(data, ["name", "title"]) ?? defaultLabel,
			used: used ?? 0,
			limit: limit ?? 0,
			...(this.parseResetIso(data)
				? { resetIso: this.parseResetIso(data)! }
				: {}),
		};
	}

	private buildLimitLabel(
		item: Record<string, unknown>,
		detail: Record<string, unknown>,
		window: Record<string, unknown>,
		index: number,
	): string {
		for (const key of ["name", "title", "scope"]) {
			const value =
				this.getStringField(item, [key]) ?? this.getStringField(detail, [key]);
			if (value) return value;
		}

		const duration =
			this.getNumberField(window, ["duration"]) ??
			this.getNumberField(item, ["duration"]) ??
			this.getNumberField(detail, ["duration"]);
		const timeUnit = String(
			window["timeUnit"] ?? item["timeUnit"] ?? detail["timeUnit"] ?? "",
		);

		if (duration !== undefined && duration > 0) {
			if (timeUnit.includes("MINUTE")) {
				if (duration >= 60 && duration % 60 === 0) {
					return `${duration / 60}h limit`;
				}
				return `${duration}m limit`;
			}
			if (timeUnit.includes("HOUR")) return `${duration}h limit`;
			if (timeUnit.includes("DAY")) return `${duration}d limit`;
			return `${duration}s limit`;
		}

		return `Limit #${index + 1}`;
	}

	private parseResetIso(data: Record<string, unknown>): string | undefined {
		for (const key of ["reset_at", "resetAt", "reset_time", "resetTime"]) {
			const value = data[key];
			if (typeof value === "string" && value.trim()) {
				const parsed = Date.parse(value);
				if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
			}
		}
		for (const key of ["reset_in", "resetIn", "ttl"]) {
			const seconds = this.getNumberField(data, [key]);
			if (seconds !== undefined && seconds > 0) {
				return this.resetIsoFromNowSeconds(seconds);
			}
		}
		const window = this.asRecord(data["window"]);
		if (window) {
			const seconds = this.getNumberField(window, ["duration"]);
			if (seconds !== undefined && seconds > 0) {
				return this.resetIsoFromNowSeconds(seconds);
			}
		}
		return undefined;
	}

	private toSnapshot(window: KimiWindow): UsageSnapshot {
		// Kimi For Coding reports usage as a percentage of the window limit,
		// not token counts — normalize to a 0–100 scale.
		const pct =
			window.limit > 0
				? Math.min(100, (window.used / window.limit) * 100)
				: window.used;
		return {
			type: this.windowType(window.label),
			group: "Kimi Code",
			total: 100,
			used: Math.round(pct * 100) / 100,
			unit: "%",
			resetIso: window.resetIso ?? new Date().toISOString(),
		};
	}

	private windowType(label: string): UsageSnapshot["type"] {
		const normalized = label.toLowerCase();
		if (normalized.includes("5h") || normalized.includes("5 h")) return "5h";
		if (
			normalized.includes("weekly") ||
			normalized.includes("week") ||
			normalized.includes("7d")
		) {
			return "weekly";
		}
		if (
			normalized.includes("monthly") ||
			normalized.includes("month") ||
			normalized.includes("30d")
		) {
			return "monthly";
		}
		return "daily";
	}
}
