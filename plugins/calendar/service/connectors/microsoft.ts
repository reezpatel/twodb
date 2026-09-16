import type { CalendarCredentials } from "../lib/crypto";
import type { IcsEvent } from "../lib/ics";
import type { CalendarConnector, PullResult, RemoteCalendar } from "./types";

/**
 * Microsoft 365 / Outlook via Microsoft Graph. OAuth against the v2
 * endpoints with TWODB_MICROSOFT_CLIENT_ID / TWODB_MICROSOFT_CLIENT_SECRET
 * (multi-tenant "common" authority).
 */

const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPE = "offline_access Calendars.ReadWrite";

function clientId(): string {
	const id = process.env.TWODB_MICROSOFT_CLIENT_ID;
	if (!id) throw new Error("TWODB_MICROSOFT_CLIENT_ID is not configured.");
	return id;
}

function clientSecret(): string {
	const secret = process.env.TWODB_MICROSOFT_CLIENT_SECRET;
	if (!secret)
		throw new Error("TWODB_MICROSOFT_CLIENT_SECRET is not configured.");
	return secret;
}

async function graph<T>(
	credentials: CalendarCredentials,
	path: string,
): Promise<T> {
	const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
	const res = await fetch(url, {
		headers: { authorization: `Bearer ${credentials.access_token}` },
	});
	if (!res.ok) {
		throw new Error(`Microsoft Graph ${res.status}: ${await res.text()}`);
	}
	return (await res.json()) as T;
}

interface GraphEvent {
	id: string;
	subject?: string;
	bodyPreview?: string;
	location?: { displayName?: string };
	start?: { dateTime: string; timeZone?: string };
	end?: { dateTime: string; timeZone?: string };
	isAllDay?: boolean;
	isCancelled?: boolean;
	recurrence?: { pattern?: object; range?: object } | null;
	organizer?: { emailAddress?: { address?: string } };
	attendees?: {
		emailAddress: { address: string; name?: string };
		type?: string;
		status?: { response?: string };
	}[];
	isOnlineMeeting?: boolean;
	onlineMeetingUrl?: string;
}

/** Translate a Graph recurrence object into an RRULE string (subset). */
function graphRecurrenceToRrule(
	recurrence: GraphEvent["recurrence"],
): string | null {
	if (!recurrence?.pattern) return null;
	const pattern = recurrence.pattern as {
		type?: string;
		interval?: number;
		daysOfWeek?: string[];
		dayOfMonth?: number;
	};
	const range = (recurrence.range ?? {}) as {
		numberOfOccurrences?: number;
		endDate?: string;
	};

	const freq =
		{
			daily: "DAILY",
			weekly: "WEEKLY",
			absoluteMonthly: "MONTHLY",
			absoluteYearly: "YEARLY",
		}[pattern.type ?? ""] ?? null;
	if (!freq) return null;

	const parts = [`FREQ=${freq}`];
	if (pattern.interval && pattern.interval > 1)
		parts.push(`INTERVAL=${pattern.interval}`);
	if (pattern.daysOfWeek?.length) {
		parts.push(
			`BYDAY=${pattern.daysOfWeek.map((d) => d.slice(0, 2).toUpperCase()).join(",")}`,
		);
	}
	if (pattern.dayOfMonth) parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
	if (range.numberOfOccurrences)
		parts.push(`COUNT=${range.numberOfOccurrences}`);
	else if (range.endDate)
		parts.push(`UNTIL=${range.endDate.replace(/-/g, "")}T000000Z`);
	return parts.join(";");
}

function mapGraphRsvp(
	response: string | undefined,
): IcsEvent["attendees"][number]["rsvp"] {
	switch (response) {
		case "accepted":
			return "accepted";
		case "declined":
			return "declined";
		case "tentativelyAccepted":
			return "tentative";
		default:
			return "needs_action";
	}
}

function toIcsEvent(event: GraphEvent): IcsEvent {
	const start = new Date(event.start?.dateTime ?? "");
	const end = new Date(event.end?.dateTime ?? "");
	return {
		uid: event.id,
		title: event.subject ?? "Untitled event",
		description: event.bodyPreview ?? null,
		location: event.location?.displayName ?? null,
		url: event.isOnlineMeeting ? (event.onlineMeetingUrl ?? null) : null,
		start_at: start,
		end_at: end,
		all_day: event.isAllDay ?? false,
		timezone: event.start?.timeZone ?? null,
		rrule: graphRecurrenceToRrule(event.recurrence),
		exdates: [],
		status: event.isCancelled ? "cancelled" : "confirmed",
		organizer_email: event.organizer?.emailAddress?.address ?? null,
		attendees: (event.attendees ?? []).map((a) => ({
			email: a.emailAddress.address,
			name: a.emailAddress.name ?? null,
			role:
				a.type === "optional" ? ("optional" as const) : ("required" as const),
			rsvp: mapGraphRsvp(a.status?.response),
		})),
		reminders: [],
	};
}

export const microsoftConnector: CalendarConnector = {
	provider: "microsoft",

	authUrl(redirectUri, state) {
		const params = new URLSearchParams({
			client_id: clientId(),
			redirect_uri: redirectUri,
			response_type: "code",
			response_mode: "query",
			scope: SCOPE,
			state,
		});
		return `${AUTHORITY}/authorize?${params.toString()}`;
	},

	async exchangeCode(code, redirectUri) {
		const res = await fetch(`${AUTHORITY}/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId(),
				client_secret: clientSecret(),
				code,
				grant_type: "authorization_code",
				redirect_uri: redirectUri,
				scope: SCOPE,
			}),
		});
		if (!res.ok)
			throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
		const body = (await res.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
		};
		return {
			access_token: body.access_token,
			refresh_token: body.refresh_token,
			expires_at: body.expires_in
				? Date.now() + body.expires_in * 1000
				: undefined,
		};
	},

	async refresh(credentials) {
		const res = await fetch(`${AUTHORITY}/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId(),
				client_secret: clientSecret(),
				refresh_token: credentials.refresh_token ?? "",
				grant_type: "refresh_token",
				scope: SCOPE,
			}),
		});
		if (!res.ok)
			throw new Error(`Microsoft token refresh failed: ${await res.text()}`);
		const body = (await res.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
		};
		return {
			...credentials,
			access_token: body.access_token,
			refresh_token: body.refresh_token ?? credentials.refresh_token,
			expires_at: body.expires_in
				? Date.now() + body.expires_in * 1000
				: undefined,
		};
	},

	async listCalendars(credentials) {
		const data = await graph<{
			value: {
				id: string;
				name: string;
				color?: string;
				canEdit?: boolean;
				isDefaultCalendar?: boolean;
			}[];
		}>(credentials, "/me/calendars");
		return data.value.map(
			(item): RemoteCalendar => ({
				remote_id: item.id,
				name: item.name,
				color: item.color ?? null,
				read_only: item.canEdit === false,
				is_primary: item.isDefaultCalendar ?? false,
			}),
		);
	},

	async pull(credentials, _account, calendar, cursor): Promise<PullResult> {
		// Delta queries give incremental sync; the deltaLink is the cursor.
		let url: string =
			cursor ??
			`${GRAPH_BASE}/me/calendars/${encodeURIComponent(calendar.remote_id)}/events/delta`;

		const events: IcsEvent[] = [];
		const deleted: string[] = [];

		while (url) {
			const data = await graph<{
				value?: (GraphEvent & { "@removed"?: object })[];
				"@odata.nextLink"?: string;
				"@odata.deltaLink"?: string;
			}>(credentials, url);
			for (const item of data.value ?? []) {
				if (item["@removed"]) deleted.push(item.id);
				else events.push(toIcsEvent(item));
			}
			url = data["@odata.nextLink"] ?? "";
			if (data["@odata.deltaLink"]) {
				return {
					events,
					deleted_remote_ids: deleted,
					cursor: data["@odata.deltaLink"],
				};
			}
		}

		return { events, deleted_remote_ids: deleted, cursor: null };
	},
};
