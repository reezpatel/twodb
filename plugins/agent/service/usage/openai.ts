import { UsageProvider, type UsageSnapshot } from "./base";

const OPENAI_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const USER_AGENT = "twodb-agent/1.0";

type RateLimitWindow = {
	used_percent: number;
	limit_window_seconds: number;
	reset_after_seconds: number;
	reset_at?: number;
};

type OpenAIUsageResponse = {
	plan_type?: string;
	rate_limit?: {
		limit_reached?: boolean;
		primary_window?: RateLimitWindow;
		secondary_window?: RateLimitWindow | null;
	} | null;
	code_review_rate_limit?: {
		primary_window?: RateLimitWindow | null;
	} | null;
};

/**
 * Ported from llm-monitor's openai provider. Reads the ChatGPT
 * subscription quota with the OAuth access token stored in the agent's
 * secret config fields.
 */
export class OpenAIUsage extends UsageProvider {
	protected readonly groupLabel: string = "OpenAI";

	async collect(): Promise<UsageSnapshot[]> {
		const accessToken = this.requireField("access_token", "OpenAI usage");
		const payload = this.parseJwt(accessToken);
		const email = payload?.["https://api.openai.com/profile"]?.email;
		const accountId =
			this.optionalField("account_id") ??
			payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;

		const usage = await this.fetchUsage(accessToken, accountId);
		const group = this.getGroup(usage.plan_type, email);
		const results: UsageSnapshot[] = [];

		const primary = usage.rate_limit?.primary_window;
		const secondary = usage.rate_limit?.secondary_window ?? null;
		const codeReview = usage.code_review_rate_limit?.primary_window ?? null;

		if (primary) results.push(this.toSnapshot("hourly", group, primary));
		if (secondary) results.push(this.toSnapshot("weekly", group, secondary));
		if (codeReview) {
			results.push(
				this.toSnapshot("daily", `${group} Code Review`, codeReview),
			);
		}
		if (!results.length) throw new Error("No OpenAI quota data");
		return results;
	}

	private async fetchUsage(
		accessToken: string,
		accountId: string | undefined,
	): Promise<OpenAIUsageResponse> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${accessToken}`,
			"User-Agent": USER_AGENT,
			Accept: "application/json",
		};
		if (accountId) headers["ChatGPT-Account-Id"] = accountId;

		const response = await this.fetchWithTimeout(OPENAI_USAGE_URL, { headers });
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`OpenAI API error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		return this.parseJson(text, "OpenAI usage") as OpenAIUsageResponse;
	}

	private toSnapshot(
		type: UsageSnapshot["type"],
		group: string,
		window: RateLimitWindow,
	): UsageSnapshot {
		return {
			type,
			group,
			total: 100,
			used: this.clampPercent(window.used_percent),
			unit: "%",
			resetIso:
				this.resetIsoFromMs(
					typeof window.reset_at === "number"
						? window.reset_at * 1000
						: undefined,
				) ??
				this.resetIsoFromNowSeconds(window.reset_after_seconds) ??
				new Date().toISOString(),
		};
	}

	private getGroup(planType: string | undefined, email: string | undefined) {
		const raw = (planType ?? "").toLowerCase();
		let label = this.groupLabel;
		if (raw.includes("pro")) label = "OpenAI (Pro)";
		else if (raw.includes("plus")) label = "OpenAI (Plus)";
		else if (planType) label = `OpenAI (${planType})`;
		return email ? `${label} (${email})` : label;
	}

	private parseJwt(
		token: string,
	): Record<string, Record<string, string> | undefined> | null {
		try {
			const parts = token.split(".");
			if (parts.length !== 3 || !parts[1]) return null;
			const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
			const pad = (4 - (base64.length % 4)) % 4;
			return JSON.parse(
				Buffer.from(base64 + "=".repeat(pad), "base64").toString("utf8"),
			);
		} catch {
			return null;
		}
	}
}
