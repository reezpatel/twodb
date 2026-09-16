import { UsageProvider, type UsageSnapshot } from "./base";

const MINIMAX_REMAINS_URL =
	"https://api.minimax.io/v1/api/openplatform/coding_plan/remains";

type MiniMaxModelRemain = {
	model_name?: string;
	current_interval_total_count?: number;
	current_interval_usage_count?: number;
	current_interval_remaining_percent?: number;
	end_time?: number;
	current_weekly_total_count?: number;
	current_weekly_usage_count?: number;
	current_weekly_remaining_percent?: number;
	weekly_end_time?: number;
};

/** Ported from llm-monitor's minimax provider (api-key remains endpoint). */
export class MiniMaxUsage extends UsageProvider {
	async collect(): Promise<UsageSnapshot[]> {
		const token = this.requireApiKey("MiniMax usage");
		const response = await this.fetchWithTimeout(MINIMAX_REMAINS_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		});
		const text = await response.text();
		if (!response.ok) {
			throw new Error(
				`MiniMax API error ${response.status}: ${this.sanitizeErrorMessage(text)}`,
			);
		}

		const data = this.asRecord(this.parseJson(text, "MiniMax remains"));
		const baseResp = this.asRecord(data?.["base_resp"]);
		const statusCode = baseResp
			? this.getNumberField(baseResp, ["status_code"])
			: undefined;
		if (statusCode !== undefined && statusCode !== 0) {
			const statusMsg =
				(baseResp && this.getStringField(baseResp, ["status_msg"])) ??
				"unknown";
			throw new Error(`MiniMax API error ${statusCode}: ${statusMsg}`);
		}

		const remains = Array.isArray(data?.["model_remains"])
			? (data["model_remains"] as MiniMaxModelRemain[])
			: undefined;
		if (!remains) throw new Error("Invalid MiniMax remains response");

		const general = remains.find(
			(item) => item.model_name?.trim().toLowerCase() === "general",
		);
		const results = general ? this.toSnapshots(general) : [];
		if (!results.length) throw new Error("No MiniMax quota windows found");
		return results;
	}

	private toSnapshots(item: MiniMaxModelRemain): UsageSnapshot[] {
		const results: UsageSnapshot[] = [];
		const interval = this.buildSnapshot({
			type: "5h",
			total: item.current_interval_total_count,
			used: item.current_interval_usage_count,
			remainingPercent: item.current_interval_remaining_percent,
			resetMs: item.end_time,
		});
		const weekly = this.buildSnapshot({
			type: "weekly",
			total: item.current_weekly_total_count,
			used: item.current_weekly_usage_count,
			remainingPercent: item.current_weekly_remaining_percent,
			resetMs: item.weekly_end_time,
		});
		if (interval) results.push(interval);
		if (weekly) results.push(weekly);
		return results;
	}

	private buildSnapshot(params: {
		type: UsageSnapshot["type"];
		total?: number;
		used?: number;
		remainingPercent?: number;
		resetMs?: number;
	}): UsageSnapshot | undefined {
		if (
			params.remainingPercent === undefined &&
			(params.total === undefined || params.used === undefined)
		) {
			return undefined;
		}
		const used =
			params.used ??
			(params.remainingPercent !== undefined
				? 100 - this.clampPercent(params.remainingPercent)
				: 0);
		const hasCounts = params.total !== undefined && params.total > 0;
		return {
			type: params.type,
			group: "MiniMax",
			total: hasCounts ? params.total! : 100,
			used,
			unit: hasCounts ? "Tk" : "%",
			resetIso: this.resetIsoFromMs(params.resetMs) ?? new Date().toISOString(),
		};
	}
}
