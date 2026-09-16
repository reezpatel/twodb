import type { UsageSnapshot } from "./base";
import { OpenAIUsage } from "./openai";

const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

const jwtExp = (token: string): number | undefined => {
	try {
		const parts = token.split(".");
		if (parts.length !== 3 || !parts[1]) return undefined;
		const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const pad = (4 - (base64.length % 4)) % 4;
		const payload = JSON.parse(
			Buffer.from(base64 + "=".repeat(pad), "base64").toString("utf8"),
		) as { exp?: unknown };
		return typeof payload.exp === "number" ? payload.exp : undefined;
	} catch {
		return undefined;
	}
};

/**
 * Codex (ChatGPT OAuth) usage monitor. The refresh token is the durable
 * credential; access tokens are short-lived and refreshed here against
 * auth.openai.com (same PKCE client the Codex CLI uses). OpenAI rotates
 * both tokens on every exchange and rejects reuse, so each refresh hands
 * the rotated values back via secret updates — callers must persist them
 * or the stored credential dies with the next refresh.
 */
export class CodexUsage extends OpenAIUsage {
	protected override readonly groupLabel = "Codex";

	override async collect(): Promise<UsageSnapshot[]> {
		const refreshToken = this.requireField("refresh_token", "Codex usage");
		const accessToken = this.optionalField("access_token");
		if (!accessToken || this.isExpiring(accessToken)) {
			await this.refresh(refreshToken);
		}

		try {
			return await super.collect();
		} catch (error) {
			// Token rejected server-side (e.g. no exp claim to pre-check) —
			// refresh once and retry.
			if (!/401|403/.test((error as Error).message)) throw error;
			await this.refresh(refreshToken);
			return super.collect();
		}
	}

	private isExpiring(accessToken: string): boolean {
		const expSeconds = jwtExp(accessToken);
		return (
			expSeconds !== undefined &&
			expSeconds * 1000 <= Date.now() + TOKEN_EXPIRY_BUFFER_MS
		);
	}

	private async refresh(refreshToken: string): Promise<void> {
		const body = new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CODEX_CLIENT_ID,
		});
		const response = await this.fetchWithTimeout(CODEX_TOKEN_URL, {
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
				`Codex OAuth refresh error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		const data = this.asRecord(this.parseJson(text, "Codex OAuth refresh"));
		const accessToken = data
			? this.getStringField(data, ["access_token"])
			: undefined;
		if (!accessToken) {
			throw new Error("Codex OAuth refresh response missing access token");
		}

		const updates: Record<string, string> = { access_token: accessToken };
		const rotatedRefresh = data
			? this.getStringField(data, ["refresh_token"])
			: undefined;
		if (rotatedRefresh) updates.refresh_token = rotatedRefresh;
		this.setSecretUpdates(updates);
		this.creds.fields.access_token = accessToken;
	}
}
