import type { CalendarCredentials } from "../lib/crypto";
import type { IcsEvent } from "../lib/ics";
import type { CalendarConnector, PullResult, RemoteCalendar } from "./types";

/**
 * Google Calendar (API v3). OAuth via env-configured client credentials:
 * TWODB_GOOGLE_CLIENT_ID / TWODB_GOOGLE_CLIENT_SECRET.
 */

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";

function clientId(): string {
	const id = process.env.TWODB_GOOGLE_CLIENT_ID;
	if (!id) throw new Error("TWODB_GOOGLE_CLIENT_ID is not configured.");
	return id;
}

function clientSecret(): string {
	const secret = process.env.TWODB_GOOGLE_CLIENT_SECRET;
	if (!secret) throw new Error("TWODB_GOOGLE_CLIENT_SECRET is not configured.");
	return secret;
}

async function api<T>(
	credentials: CalendarCredentials,
	path: string,
): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: { authorization: `Bearer ${credentials.access_token}` },
	});
	if (!res.ok) {
		throw new Error(`Google Calendar API ${res.status}: ${await res.text()}`);
	}
	return (await res.json()) as T;
}

interface GoogleDateTime {
	dateTime?: string;
	date?: string;
	timeZone?: string;
}

interface GoogleEvent {
	id: string;
	status?: string;
	summary?: string;
	description?: string;
	location?: string;
	start?: GoogleDateTime;
	end?: GoogleDateTime;
	recurrence?: string[];
	organizer?: { email?: string };
	attendees?: {
		email: string;
		displayName?: string;
		optional?: boolean;
		responseStatus?: string;
		organizer?: boolean;
	}[];
	hangoutLink?: string;
	conferenceData?: { entryPoints?: { uri: string }[] };
	etag?: string;
}

function mapResponseStatus(
	status: string | undefined,
): IcsEvent["attendees"][number]["rsvp"] {
	switch (status) {
		case "accepted":
			return "accepted";
		case "declined":
			return "declined";
		case "tentative":
			return "tentative";
		default:
			return "needs_action";
	}
}

function toIcsEvent(event: GoogleEvent): IcsEvent {
	const allDay = !event.start?.dateTime;
	const start = new Date(event.start?.dateTime ?? event.start?.date ?? "");
	const end = new Date(
		event.end?.dateTime ?? event.end?.date ?? event.start?.date ?? "",
	);
	const rrule =
		event.recurrence?.find((line) => line.startsWith("RRULE:")) ?? null;
	const exdates = (event.recurrence ?? [])
		.filter((line) => line.startsWith("EXDATE"))
		.map((line) => {
			const value = line.slice(line.indexOf(":") + 1);
			const date = new Date(
				value.replace(
					/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
					"$1-$2-$3T$4:$5:$6Z",
				),
			);
			return date.toISOString();
		});

	return {
		uid: event.id,
		title: event.summary ?? "Untitled event",
		description: event.description ?? null,
		location: event.location ?? null,
		url:
			event.hangoutLink ?? event.conferenceData?.entryPoints?.[0]?.uri ?? null,
		start_at: start,
		end_at: end,
		all_day: allDay,
		timezone: event.start?.timeZone ?? null,
		rrule: rrule ? rrule.replace(/^RRULE:/, "") : null,
		exdates,
		status: event.status === "cancelled" ? "cancelled" : "confirmed",
		organizer_email: event.organizer?.email ?? null,
		attendees: (event.attendees ?? []).map((a) => ({
			email: a.email,
			name: a.displayName ?? null,
			role: a.organizer
				? ("organizer" as const)
				: a.optional
					? ("optional" as const)
					: ("required" as const),
			rsvp: mapResponseStatus(a.responseStatus),
		})),
		reminders: [],
	};
}

export const googleConnector: CalendarConnector = {
	provider: "google",

	authUrl(redirectUri, state) {
		const params = new URLSearchParams({
			client_id: clientId(),
			redirect_uri: redirectUri,
			response_type: "code",
			scope: SCOPE,
			access_type: "offline",
			prompt: "consent",
			state,
		});
		return `${AUTH_BASE}?${params.toString()}`;
	},

	async exchangeCode(code, redirectUri) {
		const res = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId(),
				client_secret: clientSecret(),
				code,
				grant_type: "authorization_code",
				redirect_uri: redirectUri,
			}),
		});
		if (!res.ok)
			throw new Error(`Google token exchange failed: ${await res.text()}`);
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
		const res = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId(),
				client_secret: clientSecret(),
				refresh_token: credentials.refresh_token ?? "",
				grant_type: "refresh_token",
			}),
		});
		if (!res.ok)
			throw new Error(`Google token refresh failed: ${await res.text()}`);
		const body = (await res.json()) as {
			access_token: string;
			expires_in?: number;
		};
		return {
			...credentials,
			access_token: body.access_token,
			expires_at: body.expires_in
				? Date.now() + body.expires_in * 1000
				: undefined,
		};
	},

	async listCalendars(credentials) {
		const data = await api<{
			items: {
				id: string;
				summary: string;
				backgroundColor?: string;
				accessRole?: string;
				primary?: boolean;
			}[];
		}>(credentials, "/users/me/calendarList");
		return data.items.map(
			(item): RemoteCalendar => ({
				remote_id: item.id,
				name: item.summary,
				color: item.backgroundColor ?? null,
				read_only: item.accessRole === "reader",
				is_primary: item.primary ?? false,
			}),
		);
	},

	async pull(credentials, _account, calendar, cursor): Promise<PullResult> {
		const params = new URLSearchParams({ singleEvents: "false" });
		if (cursor) params.set("syncToken", cursor);

		const events: IcsEvent[] = [];
		const deleted: string[] = [];
		let pageToken: string | undefined;
		let nextCursor: string | null = null;

		do {
			if (pageToken) params.set("pageToken", pageToken);
			const data = await api<{
				items?: GoogleEvent[];
				nextPageToken?: string;
				nextSyncToken?: string;
			}>(
				credentials,
				`/calendars/${encodeURIComponent(calendar.remote_id)}/events?${params.toString()}`,
			);
			for (const item of data.items ?? []) {
				if (item.status === "cancelled" && cursor) {
					deleted.push(item.id);
				} else {
					events.push(toIcsEvent(item));
				}
			}
			pageToken = data.nextPageToken;
			if (data.nextSyncToken) nextCursor = data.nextSyncToken;
		} while (pageToken);

		return { events, deleted_remote_ids: deleted, cursor: nextCursor };
	},
};
