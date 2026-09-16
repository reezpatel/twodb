import { UsageProvider, type UsageSnapshot } from "./base";

const OLLAMA_CLOUD_SETTINGS_URL = "https://ollama.com/settings";
const USER_AGENT = "twodb-agent/1.0";

type OllamaWindow = {
	percentUsed: number;
	resetIso?: string;
};

/**
 * Ported from llm-monitor's ollama-cloud provider. Ollama Cloud has no
 * usage JSON api — the settings page HTML carries the quota widgets, so
 * the session cookie from the agent's secret config fields is required.
 */
export class OllamaCloudUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const cookie = this.requireField("cookie", "Ollama Cloud usage");
		const html = await this.fetchSettingsHtml(cookie);
		const session = this.parseWindow(html, "Session usage", 0);
		const weekly = this.parseWindow(html, "Weekly usage", 1);
		const results: UsageSnapshot[] = [];

		if (session) results.push(this.toSnapshot("5h", session));
		if (weekly) results.push(this.toSnapshot("weekly", weekly));
		if (!results.length) throw new Error("No Ollama Cloud quota windows found");
		return results;
	}

	private async fetchSettingsHtml(cookie: string): Promise<string> {
		const response = await this.fetchWithTimeout(OLLAMA_CLOUD_SETTINGS_URL, {
			headers: {
				Cookie: `__Secure-session=${cookie}`,
				"User-Agent": USER_AGENT,
				Accept: "text/html",
			},
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`Ollama Cloud API error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}
		return text;
	}

	private parseWindow(
		html: string,
		ariaLabel: string,
		resetIndex: number,
	): OllamaWindow | undefined {
		const percentMatch = html.match(
			new RegExp(
				`aria-label="${ariaLabel}\\s+(\\d+(?:\\.\\d+)?)%\\s+used"`,
				"u",
			),
		);
		if (!percentMatch?.[1]) return undefined;
		const percentUsed = Number(percentMatch[1]);
		if (!Number.isFinite(percentUsed)) return undefined;

		const resetTimes = [
			...html.matchAll(
				/class="[^"]*local-time[^"]*"\s*\n?\s*data-time="([^"]+)"/gu,
			),
		];
		const resetIso = resetTimes[resetIndex]?.[1];

		return { percentUsed, ...(resetIso ? { resetIso } : {}) };
	}

	private toSnapshot(
		type: UsageSnapshot["type"],
		window: OllamaWindow,
	): UsageSnapshot {
		return {
			type,
			group: "Ollama Cloud",
			total: 100,
			used: this.clampPercent(window.percentUsed),
			unit: "%",
			resetIso: window.resetIso ?? new Date().toISOString(),
		};
	}
}
