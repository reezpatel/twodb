import type { CalendarProvider } from "@twodb/contracts";
import type { CalendarCredentials } from "../lib/crypto";
import type { IcsEvent } from "../lib/ics";

/** A calendar as advertised by a remote provider. */
export interface RemoteCalendar {
	remote_id: string;
	name: string;
	color: string | null;
	read_only: boolean;
	is_primary: boolean;
}

/** Result of one incremental (or full) pull from a remote calendar. */
export interface PullResult {
	events: IcsEvent[];
	/** Deleted remote ids since the last sync (incremental syncs only). */
	deleted_remote_ids: string[];
	/** Opaque cursor for the next sync (syncToken / deltaLink / ctag). */
	cursor: string | null;
}

export interface AccountLike {
	provider: CalendarProvider;
	remote_url: string | null;
	sync_cursor: string | null;
}

/**
 * Validates a user-supplied remote URL before the server fetches it.
 * Only http(s) URLs are allowed; loopback and obvious local names are
 * rejected (SSRF guard).
 */
export function assertRemoteUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("Remote URL is not a valid URL.");
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("Remote URL must use http(s).");
	}
	const host = url.hostname.toLowerCase();
	if (
		host === "localhost" ||
		host === "127.0.0.1" ||
		host === "::1" ||
		host === "0.0.0.0" ||
		host.endsWith(".local") ||
		host.endsWith(".internal")
	) {
		throw new Error("Remote URL must not point at a local address.");
	}
	return url;
}

/**
 * One implementation per external provider. OAuth providers additionally
 * implement authUrl/exchangeCode; basic-auth providers (CalDAV) and ICS
 * feeds only sync.
 */
export interface CalendarConnector {
	provider: CalendarProvider;

	/** Authorization URL to send the user to (OAuth providers). */
	authUrl?(redirectUri: string, state: string): string;

	/** Swap an authorization code for stored credentials. */
	exchangeCode?(
		code: string,
		redirectUri: string,
	): Promise<CalendarCredentials>;

	/** Refresh an expired access token, returning updated credentials. */
	refresh?(credentials: CalendarCredentials): Promise<CalendarCredentials>;

	/** List the calendars the account exposes remotely. */
	listCalendars(
		credentials: CalendarCredentials,
		account: AccountLike,
	): Promise<RemoteCalendar[]>;

	/** Pull events for one remote calendar (incremental when possible). */
	pull(
		credentials: CalendarCredentials,
		account: AccountLike,
		calendar: { remote_id: string },
		cursor: string | null,
	): Promise<PullResult>;
}
