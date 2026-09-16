import { UsageProvider, type UsageSnapshot } from "./base";

const ZAI_QUOTA_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
const USER_AGENT = "twodb-agent/1.0";

type ZaiLimit = {
	type?: string;
	unit?: number;
	percentage?: number;
	nextResetTime?: number;
};

/** Ported from llm-monitor's zai provider (api-key quota endpoint). */
export class ZaiUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const apiKey = this.requireApiKey("Z.ai usage");
		const response = await this.fetchWithTimeout(ZAI_QUOTA_URL, {
			headers: {
				Authorization: apiKey,
				"User-Agent": USER_AGENT,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Z.ai API error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}

		const parsed = this.asRecord(this.parseJson(text, "Z.ai quota"));
		const data = this.asRecord(parsed?.["data"]);
		const limits = Array.isArray(data?.["limits"])
			? (data["limits"] as ZaiLimit[])
			: undefined;
		if (!limits) throw new Error("Invalid Z.ai quota data");

		const results = limits.flatMap((limit) => {
			const snapshot = this.toSnapshot(limit);
			return snapshot ? [snapshot] : [];
		});
		if (!results.length) throw new Error("No Z.ai quota windows found");
		return results;
	}

	private toSnapshot(limit: ZaiLimit): UsageSnapshot | undefined {
		if (
			typeof limit.percentage !== "number" ||
			!Number.isFinite(limit.percentage)
		) {
			return undefined;
		}
		const used = this.clampPercent(limit.percentage);
		const resetIso =
			this.resetIsoFromMs(limit.nextResetTime) ?? new Date().toISOString();

		if (limit.type === "TOKENS_LIMIT") {
			if (limit.unit === 3) {
				return {
					type: "5h",
					group: "Z.ai",
					total: 100,
					used,
					unit: "%",
					resetIso,
				};
			}
			if (limit.unit === 4) {
				return {
					type: "daily",
					group: "Z.ai",
					total: 100,
					used,
					unit: "%",
					resetIso,
				};
			}
			if (limit.unit === 6) {
				return {
					type: "weekly",
					group: "Z.ai",
					total: 100,
					used,
					unit: "%",
					resetIso,
				};
			}
		}
		if (limit.type === "TIME_LIMIT") {
			return {
				type: "monthly",
				group: "Z.ai MCP",
				total: 100,
				used,
				unit: "%",
				resetIso,
			};
		}
		return undefined;
	}
}
