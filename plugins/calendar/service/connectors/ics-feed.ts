import { parseIcs } from "../lib/ics";
import type { CalendarConnector, PullResult, RemoteCalendar } from "./types";
import { assertRemoteUrl } from "./types";

/**
 * Read-only ICS feed subscription (public holiday calendars, sports
 * schedules, …). The account's remote_url points at the .ics resource;
 * every sync is a full refresh.
 */
export const icsFeedConnector: CalendarConnector = {
	provider: "ics",

	async listCalendars(_credentials, account): Promise<RemoteCalendar[]> {
		if (!account.remote_url)
			throw new Error("ICS feed account has no remote_url.");
		return [
			{
				remote_id: account.remote_url,
				name: account.remote_url.split("/").pop() ?? "Feed",
				color: null,
				read_only: true,
				is_primary: true,
			},
		];
	},

	async pull(_credentials, account, _calendar, _cursor): Promise<PullResult> {
		if (!account.remote_url)
			throw new Error("ICS feed account has no remote_url.");
		// Validated (http(s), non-local) before any outbound request.
		const feedUrl = assertRemoteUrl(account.remote_url).href;
		const res = await fetch(feedUrl);
		if (!res.ok) {
			throw new Error(`ICS feed fetch failed: ${res.status}`);
		}
		return {
			events: parseIcs(await res.text()),
			deleted_remote_ids: [],
			cursor: null,
		};
	},
};
