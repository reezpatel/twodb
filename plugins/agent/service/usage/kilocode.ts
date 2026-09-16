import { UsageProvider, type UsageSnapshot } from "./base";

const KILO_BALANCE_URL = "https://app.kilo.ai/api/profile/balance";
const KILO_SESSION_URL = "https://app.kilo.ai/api/auth/session";
const USER_AGENT = "twodb-agent/1.0";

/**
 * Kilo Code balance monitor. The balance api sits behind the web session
 * (next-auth), so the `__Secure-next-auth.session-token` cookie from the
 * agent's secret config fields is required. The session api also tells us
 * when the cookie itself expires — carried in reset_at so the UI can warn
 * before monitoring goes stale.
 */
export class KilocodeUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const cookie = this.requireField("session_cookie", "Kilo Code usage");
		const authHeaders = {
			Cookie: `__Secure-next-auth.session-token=${cookie}`,
			"User-Agent": USER_AGENT,
			Accept: "application/json",
		};

		const response = await this.fetchWithTimeout(KILO_BALANCE_URL, {
			headers: authHeaders,
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Kilo Code API error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}

		const data = this.asRecord(this.parseJson(text, "Kilo Code balance"));
		const balance = data
			? this.getNumberField(data, ["balance"])
			: undefined;
		if (balance === undefined) {
			throw new Error(
				"Kilo Code balance response invalid — session cookie may have expired",
			);
		}

		return [
			{
				type: "balance",
				group: "Kilo Code",
				total: balance,
				used: 0,
				unit: "$",
				resetIso:
					(await this.sessionExpiry(authHeaders)) ??
					new Date().toISOString(),
			},
		];
	}

	private async sessionExpiry(
		headers: Record<string, string>,
	): Promise<string | undefined> {
		try {
			const response = await this.fetchWithTimeout(KILO_SESSION_URL, {
				headers,
			});
			if (!response.ok) return undefined;
			const data = this.asRecord(
				this.parseJson(await response.text(), "Kilo Code session"),
			);
			const expires = data
				? this.getStringField(data, ["expires"])
				: undefined;
			return expires && Number.isFinite(Date.parse(expires))
				? new Date(Date.parse(expires)).toISOString()
				: undefined;
		} catch {
			return undefined;
		}
	}
}
