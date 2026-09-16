import { UsageProvider, type UsageSnapshot } from "./base";

const ANTHROPIC_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const ANTHROPIC_REFRESH_URL = "https://platform.claude.com/v1/oauth/token";
const ANTHROPIC_BETA_HEADER = "oauth-2025-04-20";
const CLAUDE_AI_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type AnthropicWindow = {
	usedPercent: number;
	resetIso?: string;
};

/**
 * Ported from llm-monitor's anthropic provider. Uses the Claude OAuth
 * tokens stored in the agent's secret config fields — the refresh token
 * is the durable credential; access tokens are short-lived and refreshed
 * here against platform.claude.com (same client the Claude Code CLI
 * uses). Rotated tokens are handed back via secret updates for
 * persistence, since reuse of a stale refresh token is rejected.
 */
export class AnthropicUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const refreshToken = this.requireField("refresh_token", "Anthropic usage");
		let accessToken = this.optionalField("access_token");
		const expiresAt = Number(this.optionalField("expires_at") ?? "");
		const expiring =
			Number.isFinite(expiresAt) &&
			expiresAt > 0 &&
			expiresAt <= Date.now() + TOKEN_EXPIRY_BUFFER_MS;

		if (!accessToken || expiring) {
			accessToken = await this.refresh(refreshToken);
		}

		const usage = await this.fetchUsage(accessToken).catch(
			async (error: unknown) => {
				if (/401|403/.test((error as Error).message)) {
					return this.fetchUsage(await this.refresh(refreshToken));
				}
				throw error;
			},
		);

		const results: UsageSnapshot[] = [];
		if (usage.fiveHour) {
			results.push(this.toSnapshot("5h", usage.fiveHour));
		}
		if (usage.sevenDay) {
			results.push(this.toSnapshot("weekly", usage.sevenDay));
		}
		if (!results.length) {
			throw new Error("Could not parse Anthropic usage response");
		}
		return results;
	}

	private async refresh(refreshToken: string): Promise<string> {
		const body = new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLAUDE_AI_CLIENT_ID,
		});
		const response = await this.fetchWithTimeout(ANTHROPIC_REFRESH_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body,
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Anthropic OAuth refresh error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		const data = this.asRecord(this.parseJson(text, "Anthropic OAuth refresh"));
		const accessToken = data
			? this.getStringField(data, ["access_token", "accessToken"])
			: undefined;
		if (!accessToken) {
			throw new Error("Anthropic OAuth refresh response missing access token");
		}

		// Claude may rotate the refresh token — persist whatever comes back
		// so the stored credential survives either way.
		const updates: Record<string, string> = { access_token: accessToken };
		const rotatedRefresh = data
			? this.getStringField(data, ["refresh_token", "refreshToken"])
			: undefined;
		if (rotatedRefresh) updates.refresh_token = rotatedRefresh;
		const expiresIn = data
			? this.getNumberField(data, ["expires_in", "expiresIn"])
			: undefined;
		if (expiresIn !== undefined && expiresIn > 0) {
			updates.expires_at = String(Date.now() + expiresIn * 1000);
		}
		this.setSecretUpdates(updates);

		this.creds.fields.access_token = accessToken;
		if (updates.expires_at) this.creds.fields.expires_at = updates.expires_at;
		return accessToken;
	}

	private async fetchUsage(
		accessToken: string,
	): Promise<{ fiveHour?: AnthropicWindow; sevenDay?: AnthropicWindow }> {
		const response = await this.fetchWithTimeout(ANTHROPIC_USAGE_URL, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"anthropic-beta": ANTHROPIC_BETA_HEADER,
				Accept: "application/json",
			},
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Anthropic usage error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		return this.parseUsageResponse(this.parseJson(text, "Anthropic usage"));
	}

	private parseUsageResponse(data: unknown): {
		fiveHour?: AnthropicWindow;
		sevenDay?: AnthropicWindow;
	} {
		const root = this.asRecord(data);
		if (!root) return {};
		const roots = [
			root,
			this.asRecord(root["quota"]),
			this.asRecord(root["usage"]),
			this.asRecord(root["rate_limits"]),
			this.asRecord(root["rateLimits"]),
			this.asRecord(root["oauth_usage"]),
			this.asRecord(root["oauthUsage"]),
		].filter((value): value is Record<string, unknown> => !!value);

		for (const candidate of roots) {
			const fiveHour = this.parseWindow(
				candidate["five_hour"] ?? candidate["fiveHour"],
			);
			const sevenDay = this.parseWindow(
				candidate["seven_day"] ?? candidate["sevenDay"],
			);
			if (fiveHour || sevenDay) {
				return {
					...(fiveHour ? { fiveHour } : {}),
					...(sevenDay ? { sevenDay } : {}),
				};
			}
		}
		return {};
	}

	private parseWindow(value: unknown): AnthropicWindow | undefined {
		const window = this.asRecord(value);
		if (!window) return undefined;
		const usedPercent = this.getNumberField(window, [
			"utilization",
			"used_percentage",
			"usedPercentage",
			"used_percent",
			"usedPercent",
			"percent_used",
			"percentUsed",
		]);
		if (usedPercent === undefined) return undefined;

		const resetRaw =
			window["resets_at"] ??
			window["resetsAt"] ??
			window["reset_at"] ??
			window["resetAt"];
		const resetIso =
			typeof resetRaw === "string" && Number.isFinite(Date.parse(resetRaw))
				? new Date(Date.parse(resetRaw)).toISOString()
				: undefined;

		return { usedPercent, ...(resetIso ? { resetIso } : {}) };
	}

	private toSnapshot(
		type: UsageSnapshot["type"],
		window: AnthropicWindow,
	): UsageSnapshot {
		return {
			type,
			group: "Claude",
			total: 100,
			used: Math.max(0, window.usedPercent),
			unit: "%",
			resetIso: window.resetIso ?? new Date().toISOString(),
		};
	}
}
