import { UsageProvider, type UsageSnapshot } from "./base";

const CLINE_API_BASE = "https://api.cline.bot";
const USER_AGENT = "twodb-agent/1.0";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const MICRO_DOLLARS = 1_000_000;

/**
 * Cline balance monitor (api.cline.bot). Uses the OAuth-style session
 * tokens stored in the agent's secret config fields — the refresh token
 * is the durable credential; access tokens are short-lived and refreshed
 * here via /api/v1/auth/refresh. Rotated tokens are handed back via
 * secret updates for persistence. Balances come back in micro-dollars.
 */
export class ClineUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const refreshToken = this.requireField("refresh_token", "Cline usage");
		let accessToken = this.optionalField("access_token");
		const expiresAt = Number(this.optionalField("expires_at") ?? "");
		const expiring =
			Number.isFinite(expiresAt) &&
			expiresAt > 0 &&
			expiresAt <= Date.now() + TOKEN_EXPIRY_BUFFER_MS;

		if (!accessToken || expiring) {
			accessToken = await this.refresh(refreshToken);
		}

		let userId: string;
		try {
			userId = await this.fetchUserId(accessToken);
		} catch (error) {
			if (/401|403/.test((error as Error).message)) {
				accessToken = await this.refresh(refreshToken);
				userId = await this.fetchUserId(accessToken);
			} else {
				throw error;
			}
		}

		const response = await this.fetchWithTimeout(
			`${CLINE_API_BASE}/api/v1/users/${userId}/balance`,
			{ headers: this.authHeaders(accessToken) },
		);
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Cline balance error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		const data = this.asRecord(this.parseJson(text, "Cline balance"));
		const microDollars = data
			? this.getNumberField(data, ["balance"])
			: undefined;
		if (microDollars === undefined) {
			throw new Error("Invalid Cline balance response");
		}

		return [
			{
				type: "balance",
				group: "Cline",
				total: microDollars / MICRO_DOLLARS,
				used: 0,
				unit: "$",
				resetIso:
					this.resetIsoFromMs(
						Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : undefined,
					) ?? new Date().toISOString(),
			},
		];
	}

	private async refresh(refreshToken: string): Promise<string> {
		const response = await this.fetchWithTimeout(
			`${CLINE_API_BASE}/api/v1/auth/refresh`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					"User-Agent": USER_AGENT,
				},
				body: JSON.stringify({ refreshToken }),
			},
		);
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Cline token refresh error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		const root = this.asRecord(this.parseJson(text, "Cline token refresh"));
		const data = this.asRecord(root?.["data"]) ?? root;
		const accessToken = data
			? this.getStringField(data, ["accessToken", "access_token"])
			: undefined;
		if (!accessToken) {
			throw new Error("Cline refresh response missing access token");
		}

		// The session may come back rotated — persist whatever is present so
		// the stored credential survives either way.
		const updates: Record<string, string> = { access_token: accessToken };
		const rotatedRefresh = data
			? this.getStringField(data, ["refreshToken", "refresh_token"])
			: undefined;
		if (rotatedRefresh) updates.refresh_token = rotatedRefresh;
		const expiry = data ? this.parseExpiry(data) : undefined;
		if (expiry !== undefined) updates.expires_at = String(expiry);
		this.setSecretUpdates(updates);

		this.creds.fields.access_token = accessToken;
		if (updates.expires_at) this.creds.fields.expires_at = updates.expires_at;
		return accessToken;
	}

	/** expiresAt as absolute ms epoch, or expiresIn (seconds if small, ms if large — token lifetimes are hours). */
	private parseExpiry(data: Record<string, unknown>): number | undefined {
		const expiresAt = this.getNumberField(data, ["expiresAt", "expires_at"]);
		if (
			expiresAt !== undefined &&
			expiresAt > Date.now() - TOKEN_EXPIRY_BUFFER_MS
		) {
			return Math.round(expiresAt);
		}
		const expiresIn = this.getNumberField(data, ["expiresIn", "expires_in"]);
		if (expiresIn !== undefined && expiresIn > 0) {
			return Math.round(
				Date.now() + (expiresIn < 1_000_000 ? expiresIn * 1000 : expiresIn),
			);
		}
		return undefined;
	}

	private async fetchUserId(accessToken: string): Promise<string> {
		const response = await this.fetchWithTimeout(
			`${CLINE_API_BASE}/api/v1/users/me`,
			{ headers: this.authHeaders(accessToken) },
		);
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Cline users/me error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		const data = this.asRecord(this.parseJson(text, "Cline users/me"));
		const id = data ? this.getStringField(data, ["id"]) : undefined;
		if (!id) throw new Error("Invalid Cline users/me response");
		return id;
	}

	private authHeaders(accessToken: string): Record<string, string> {
		// api.cline.bot expects the workos:-prefixed bearer — providers.json
		// stores accessToken with the prefix, refresh responses without
		const bearer = /^workos:/i.test(accessToken)
			? accessToken
			: `workos:${accessToken}`;
		return {
			Authorization: `Bearer ${bearer}`,
			"User-Agent": USER_AGENT,
			Accept: "application/json",
		};
	}
}
