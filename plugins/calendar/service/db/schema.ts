import type {
	CalendarAccountStatus,
	CalendarAttendeeRole,
	CalendarEventStatus,
	CalendarProvider,
	CalendarReminderMethod,
	CalendarRsvp,
} from "@twodb/contracts";
import type { Generated } from "kysely";

export interface CalAccountsTable {
	id: string;
	workspace_id: string;
	provider: CalendarProvider;
	label: string;
	email: string | null;
	status: Generated<CalendarAccountStatus>;
	/** AES-GCM blob (see lib/crypto.ts) holding provider tokens/feed URL. */
	credentials: Generated<string | null>;
	/** Remote URL for ICS feed / CalDAV base URL (not secret). */
	remote_url: Generated<string | null>;
	sync_cursor: Generated<string | null>;
	last_synced_at: Generated<Date | null>;
	error: Generated<string | null>;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface CalCalendarsTable {
	id: string;
	account_id: string;
	workspace_id: string;
	remote_id: string | null;
	name: string;
	color: string | null;
	read_only: Generated<boolean>;
	is_primary: Generated<boolean>;
	visible: Generated<boolean>;
	position: Generated<number>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface CalEventsTable {
	id: string;
	calendar_id: string;
	workspace_id: string;
	remote_id: string | null;
	etag: Generated<string | null>;
	title: string;
	description: string | null;
	location: string | null;
	conferencing_url: string | null;
	start_at: Date;
	end_at: Date;
	all_day: Generated<boolean>;
	timezone: string | null;
	rrule: string | null;
	/** JSON array of ISO timestamps. */
	exdates: Generated<unknown>;
	status: Generated<CalendarEventStatus>;
	organizer_email: string | null;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface CalEventAttendeesTable {
	id: string;
	event_id: string;
	email: string;
	name: string | null;
	role: Generated<CalendarAttendeeRole>;
	rsvp: Generated<CalendarRsvp>;
}

export interface CalEventRemindersTable {
	id: string;
	event_id: string;
	method: Generated<CalendarReminderMethod>;
	minutes_before: number;
}

export interface CalendarDB {
	cal_accounts: CalAccountsTable;
	cal_calendars: CalCalendarsTable;
	cal_events: CalEventsTable;
	cal_event_attendees: CalEventAttendeesTable;
	cal_event_reminders: CalEventRemindersTable;
}
