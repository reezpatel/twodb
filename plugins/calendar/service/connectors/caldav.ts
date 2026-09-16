import type { CalendarCredentials } from "../lib/crypto";
import { parseIcs, type IcsEvent } from "../lib/ics";
import type {
	AccountLike,
	CalendarConnector,
	PullResult,
	RemoteCalendar,
} from "./types";

/**
 * Generic CalDAV provider (RFC 4791) — covers Apple iCloud, Fastmail,
 * Nextcloud, … Basic auth with an app-specific password; the account's
 * remote_url is the CalDAV base URL (e.g. https://caldav.icloud.com or a
 * principal URL). XML parsing is intentionally regex-tolerant — CalDAV
 * responses are machine-generated and stable enough for this shape.
 */

function basicAuth(credentials: CalendarCredentials): string {
	return `Basic ${Buffer.from(
		`${credentials.username ?? ""}:${credentials.password ?? ""}`,
	).toString("base64")}`;
}

async function caldavRequest(
	credentials: CalendarCredentials,
	method: string,
	url: string,
	body: string,
	depth: "0" | "1" = "1",
): Promise<string> {
	const res = await fetch(url, {
		method,
		headers: {
			authorization: basicAuth(credentials),
			"content-type": "application/xml; charset=utf-8",
			depth,
		},
		body,
	});
	if (!res.ok) {
		throw new Error(`CalDAV ${method} ${res.status}: ${await res.text()}`);
	}
	return res.text();
}

function extractAll(xml: string, tag: string): string[] {
	const pattern = new RegExp(
		`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
		"g",
	);
	return [...xml.matchAll(pattern)].map((m) => (m[1] ?? "").trim());
}

function decodeEntities(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&amp;/g, "&");
}

function joinUrl(base: string, href: string): string {
	if (href.startsWith("http")) return href;
	let origin = "";
	try {
		origin = new URL(base).origin;
	} catch {
		return href;
	}
	return href.startsWith("/")
		? `${origin}${href}`
		: `${base.replace(/\/$/, "")}/${href}`;
}

const CALENDAR_HOME_PROPFIND = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;

const CALENDARS_PROPFIND = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <cs:getctag/>
    <c:supported-calendar-component-set/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

function calendarQuery(start: Date, end: Date): string {
	const stamp = (d: Date) =>
		d
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}Z$/, "Z");
	return `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag/><c:calendar-data/></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${stamp(start)}" end="${stamp(end)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;
}

async function calendarHomeSet(
	credentials: CalendarCredentials,
	account: AccountLike,
): Promise<string> {
	if (!account.remote_url) throw new Error("CalDAV account has no remote_url.");
	const xml = await caldavRequest(
		credentials,
		"PROPFIND",
		account.remote_url,
		CALENDAR_HOME_PROPFIND,
		"0",
	);
	const href = extractAll(xml, "calendar-home-set")
		.flatMap((set) => extractAll(set, "href"))
		.find(Boolean);
	if (!href) throw new Error("CalDAV calendar-home-set not found.");
	return joinUrl(account.remote_url, decodeEntities(href));
}

export const caldavConnector: CalendarConnector = {
	provider: "caldav",

	async listCalendars(credentials, account) {
		const home = await calendarHomeSet(credentials, account);
		const xml = await caldavRequest(
			credentials,
			"PROPFIND",
			home,
			CALENDARS_PROPFIND,
		);

		const calendars: RemoteCalendar[] = [];
		for (const response of extractAll(xml, "response")) {
			// Only actual calendars (they contain calendar-data support).
			if (!/calendar/.test(extractAll(response, "resourcetype")[0] ?? ""))
				continue;
			const href = extractAll(response, "href")[0];
			if (!href) continue;
			const name = extractAll(response, "displayname")[0] ?? "Calendar";
			calendars.push({
				remote_id: joinUrl(home, decodeEntities(href)),
				name: decodeEntities(name),
				color: null,
				read_only: false,
				is_primary: calendars.length === 0,
			});
		}
		return calendars;
	},

	async pull(credentials, _account, calendar, _cursor): Promise<PullResult> {
		// Wide-window time-range query; callers treat CalDAV syncs as full
		// refreshes inside the window (ctag-based incremental sync is a TODO).
		const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
		const xml = await caldavRequest(
			credentials,
			"REPORT",
			calendar.remote_id,
			calendarQuery(start, end),
		);

		const events: IcsEvent[] = [];
		for (const response of extractAll(xml, "response")) {
			for (const data of extractAll(response, "calendar-data")) {
				for (const event of parseIcs(decodeEntities(data))) {
					events.push(event);
				}
			}
		}
		return { events, deleted_remote_ids: [], cursor: null };
	},
};
