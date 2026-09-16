import type {
	CalendarAttendeeRole,
	CalendarEventStatus,
	CalendarReminderMethod,
	CalendarRsvp,
} from "@twodb/contracts";

/**
 * Minimal, tolerant iCalendar (RFC 5545) reader/writer. Supports what the
 * calendar plugin round-trips: VEVENT with SUMMARY/DTSTART/DTEND/LOCATION/
 * DESCRIPTION/URL/RRULE/EXDATE/STATUS/UID/ATTENDEE and VALARM reminders.
 * TZID parameters are preserved on the `timezone` field but not resolved
 * (no tz database) — times are stored as UTC instants.
 */

export interface IcsAttendee {
	email: string;
	name: string | null;
	role: CalendarAttendeeRole;
	rsvp: CalendarRsvp;
}

export interface IcsReminder {
	method: CalendarReminderMethod;
	minutes_before: number;
}

export interface IcsEvent {
	uid: string;
	title: string;
	description: string | null;
	location: string | null;
	url: string | null;
	start_at: Date;
	end_at: Date;
	all_day: boolean;
	timezone: string | null;
	rrule: string | null;
	exdates: string[];
	status: CalendarEventStatus;
	organizer_email: string | null;
	attendees: IcsAttendee[];
	reminders: IcsReminder[];
}

/* ------------------------------ writer ------------------------------ */

function escapeText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
	const limit = 75;
	if (line.length <= limit) return line;
	const parts: string[] = [line.slice(0, limit)];
	let rest = line.slice(limit);
	while (rest.length > 0) {
		parts.push(` ${rest.slice(0, limit - 1)}`);
		rest = rest.slice(limit - 1);
	}
	return parts.join("\r\n");
}

function formatUtc(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}Z$/, "Z");
}

function formatDate(date: Date): string {
	return formatUtc(date).slice(0, 8);
}

const PARTSTAT: Record<CalendarRsvp, string> = {
	needs_action: "NEEDS-ACTION",
	accepted: "ACCEPTED",
	declined: "DECLINED",
	tentative: "TENTATIVE",
};

export function buildIcs(calendarName: string, events: IcsEvent[]): string {
	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//twodb//calendar//EN",
		"CALSCALE:GREGORIAN",
		`X-WR-CALNAME:${escapeText(calendarName)}`,
	];

	for (const event of events) {
		lines.push("BEGIN:VEVENT");
		lines.push(`UID:${event.uid}`);
		lines.push(`DTSTAMP:${formatUtc(new Date())}`);
		const tzid = event.timezone ? `;TZID=${event.timezone}` : "";
		if (event.all_day) {
			lines.push(`DTSTART;VALUE=DATE:${formatDate(event.start_at)}`);
			lines.push(`DTEND;VALUE=DATE:${formatDate(event.end_at)}`);
		} else {
			lines.push(`DTSTART${tzid}:${formatUtc(event.start_at)}`);
			lines.push(`DTEND${tzid}:${formatUtc(event.end_at)}`);
		}
		lines.push(`SUMMARY:${escapeText(event.title)}`);
		if (event.description)
			lines.push(`DESCRIPTION:${escapeText(event.description)}`);
		if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
		if (event.url) lines.push(`URL:${event.url}`);
		if (event.rrule) lines.push(`RRULE:${event.rrule.replace(/^RRULE:/i, "")}`);
		for (const exdate of event.exdates) {
			lines.push(`EXDATE:${formatUtc(new Date(exdate))}`);
		}
		lines.push(`STATUS:${event.status.toUpperCase()}`);
		if (event.organizer_email)
			lines.push(`ORGANIZER:mailto:${event.organizer_email}`);
		for (const attendee of event.attendees) {
			const cn = attendee.name ? `;CN=${attendee.name}` : "";
			lines.push(
				`ATTENDEE;ROLE=${attendee.role === "organizer" ? "CHAIR" : attendee.role === "optional" ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT"};PARTSTAT=${PARTSTAT[attendee.rsvp]}${cn}:mailto:${attendee.email}`,
			);
		}
		for (const reminder of event.reminders) {
			lines.push("BEGIN:VALARM");
			lines.push(`ACTION:${reminder.method === "email" ? "EMAIL" : "DISPLAY"}`);
			lines.push(`TRIGGER:-PT${reminder.minutes_before}M`);
			lines.push("END:VALARM");
		}
		lines.push("END:VEVENT");
	}

	lines.push("END:VCALENDAR");
	return lines.map(fold).join("\r\n") + "\r\n";
}

/* ------------------------------ reader ------------------------------ */

interface IcsLine {
	name: string;
	params: Record<string, string>;
	value: string;
}

function unfold(text: string): string[] {
	return text
		.replace(/\r\n[ \t]/g, "")
		.replace(/\n[ \t]/g, "")
		.split(/\r\n|\n/)
		.filter((line) => line.trim().length > 0);
}

function parseLine(line: string): IcsLine | null {
	const sep = line.indexOf(":");
	if (sep < 0) return null;
	const head = line.slice(0, sep);
	const value = line.slice(sep + 1);
	const [name = "", ...paramParts] = head.split(";");
	const params: Record<string, string> = {};
	for (const part of paramParts) {
		const eq = part.indexOf("=");
		if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
	}
	return { name: name.toUpperCase(), params, value };
}

function unescapeText(value: string): string {
	return value
		.replace(/\\n/gi, "\n")
		.replace(/\\,/g, ",")
		.replace(/\\;/g, ";")
		.replace(/\\\\/g, "\\");
}

/** "20260115T093000Z" | "20260115T093000" | "20260115" → Date (UTC). */
function parseDateValue(value: string): Date | null {
	const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
		value.trim(),
	);
	if (!m) return null;
	const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
	const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
	return Number.isFinite(ms) ? new Date(ms) : null;
}

function mapRole(value: string | undefined): CalendarAttendeeRole {
	const v = (value ?? "").toUpperCase();
	if (v === "CHAIR") return "organizer";
	if (v === "OPT-PARTICIPANT") return "optional";
	return "required";
}

function mapPartstat(value: string | undefined): CalendarRsvp {
	const v = (value ?? "").toUpperCase();
	if (v === "ACCEPTED") return "accepted";
	if (v === "DECLINED") return "declined";
	if (v === "TENTATIVE") return "tentative";
	return "needs_action";
}

function mapStatus(value: string | undefined): CalendarEventStatus {
	const v = (value ?? "").toUpperCase();
	if (v === "CANCELLED") return "cancelled";
	if (v === "TENTATIVE") return "tentative";
	return "confirmed";
}

/** "-PT15M" / "-P1D" / "PT30M" → minutes before the event. */
function parseTriggerMinutes(value: string): number | null {
	const m = /^(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i.exec(
		value.trim(),
	);
	if (!m) return null;
	const sign = m[1] ? 1 : -1;
	const days = Number(m[2] ?? 0);
	const hours = Number(m[3] ?? 0);
	const mins = Number(m[4] ?? 0);
	return sign * (days * 24 * 60 + hours * 60 + mins);
}

export function parseIcs(text: string): IcsEvent[] {
	const events: IcsEvent[] = [];
	let current: Partial<IcsEvent> | null = null;
	let inAlarm = false;
	let alarm: IcsReminder | null = null;

	for (const raw of unfold(text)) {
		const line = parseLine(raw);
		if (!line) continue;

		if (line.name === "BEGIN" && line.value.toUpperCase() === "VEVENT") {
			current = {
				exdates: [],
				attendees: [],
				reminders: [],
				description: null,
				location: null,
				url: null,
				timezone: null,
				rrule: null,
				status: "confirmed",
				all_day: false,
				organizer_email: null,
			};
			continue;
		}
		if (line.name === "END" && line.value.toUpperCase() === "VEVENT") {
			if (current?.uid && current.start_at && current.end_at) {
				events.push({
					title: "Untitled event",
					exdates: [],
					attendees: [],
					reminders: [],
					...current,
				} as IcsEvent);
			}
			current = null;
			continue;
		}
		if (!current) continue;

		if (line.name === "BEGIN" && line.value.toUpperCase() === "VALARM") {
			inAlarm = true;
			alarm = { method: "popup", minutes_before: 0 };
			continue;
		}
		if (line.name === "END" && line.value.toUpperCase() === "VALARM") {
			if (alarm && current.reminders) current.reminders.push(alarm);
			inAlarm = false;
			alarm = null;
			continue;
		}

		if (inAlarm && alarm) {
			if (line.name === "ACTION")
				alarm.method = line.value.toUpperCase() === "EMAIL" ? "email" : "popup";
			if (line.name === "TRIGGER") {
				const mins = parseTriggerMinutes(line.value);
				if (mins !== null) alarm.minutes_before = mins;
			}
			continue;
		}

		switch (line.name) {
			case "UID":
				current.uid = line.value;
				break;
			case "SUMMARY":
				current.title = unescapeText(line.value);
				break;
			case "DESCRIPTION":
				current.description = unescapeText(line.value);
				break;
			case "LOCATION":
				current.location = unescapeText(line.value);
				break;
			case "URL":
				current.url = line.value;
				break;
			case "DTSTART": {
				const date = parseDateValue(line.value);
				if (date) current.start_at = date;
				if (line.params.VALUE?.toUpperCase() === "DATE") current.all_day = true;
				if (line.params.TZID) current.timezone = line.params.TZID;
				break;
			}
			case "DTEND": {
				const date = parseDateValue(line.value);
				if (date) current.end_at = date;
				break;
			}
			case "RRULE":
				current.rrule = line.value;
				break;
			case "EXDATE": {
				const date = parseDateValue(line.value.split(",")[0] ?? "");
				if (date) current.exdates?.push(date.toISOString());
				break;
			}
			case "STATUS":
				current.status = mapStatus(line.value);
				break;
			case "ORGANIZER":
				current.organizer_email = line.value.replace(/^mailto:/i, "");
				break;
			case "ATTENDEE":
				current.attendees?.push({
					email: line.value.replace(/^mailto:/i, ""),
					name: line.params.CN ?? null,
					role: mapRole(line.params.ROLE),
					rsvp: mapPartstat(line.params.PARTSTAT),
				});
				break;
		}
	}

	return events;
}
