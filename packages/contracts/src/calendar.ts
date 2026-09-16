/**
 * Calendar plugin contracts — DTOs shared by the service (responses) and the
 * view (rendering).
 */

export type CalendarProvider =
	| "local"
	| "google"
	| "microsoft"
	| "caldav"
	| "ics";

export type CalendarAccountStatus = "active" | "pending" | "error" | "disabled";

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";

export type CalendarRsvp =
	| "needs_action"
	| "accepted"
	| "declined"
	| "tentative";

export type CalendarAttendeeRole = "organizer" | "required" | "optional";

export type CalendarReminderMethod = "popup" | "email" | "push";

export interface CalendarAccountDto {
	id: string;
	workspace_id: string;
	provider: CalendarProvider;
	label: string;
	email: string | null;
	status: CalendarAccountStatus;
	sync_cursor: string | null;
	last_synced_at: string | null;
	error: string | null;
	created_at: string;
	updated_at: string;
}

export interface CalendarDto {
	id: string;
	account_id: string;
	workspace_id: string;
	remote_id: string | null;
	name: string;
	color: string | null;
	read_only: boolean;
	is_primary: boolean;
	visible: boolean;
	position: number;
	created_at: string;
	updated_at: string;
}

export interface CalendarAttendeeDto {
	id: string;
	email: string;
	name: string | null;
	role: CalendarAttendeeRole;
	rsvp: CalendarRsvp;
}

export interface CalendarReminderDto {
	id: string;
	method: CalendarReminderMethod;
	minutes_before: number;
}

export interface CalendarEventDto {
	id: string;
	calendar_id: string;
	workspace_id: string;
	remote_id: string | null;
	etag: string | null;
	title: string;
	description: string | null;
	location: string | null;
	conferencing_url: string | null;
	start_at: string;
	end_at: string;
	all_day: boolean;
	timezone: string | null;
	/** iCalendar RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO") — null = one-off. */
	rrule: string | null;
	/** ISO timestamps of suppressed occurrences of a recurring event. */
	exdates: string[];
	status: CalendarEventStatus;
	organizer_email: string | null;
	attendees: CalendarAttendeeDto[];
	reminders: CalendarReminderDto[];
	created_at: string;
	updated_at: string;
}

/**
 * One concrete occurrence of an event inside a range query. Recurring events
 * appear once per occurrence (sharing `id` = series id); `occurrence_start`
 * identifies the occurrence.
 */
export interface CalendarInstanceDto
	extends Omit<CalendarEventDto, "id" | "start_at" | "end_at"> {
	event_id: string;
	start_at: string;
	end_at: string;
	/** True when this instance comes from a recurring series. */
	recurring: boolean;
}

export interface UpsertCalendarEventInput {
	calendar_id: string;
	title: string;
	description?: string | null;
	location?: string | null;
	conferencing_url?: string | null;
	start_at: string;
	end_at: string;
	all_day?: boolean;
	timezone?: string | null;
	rrule?: string | null;
	exdates?: string[];
	status?: CalendarEventStatus;
	attendees?: {
		email: string;
		name?: string | null;
		role?: CalendarAttendeeRole;
	}[];
	reminders?: { method: CalendarReminderMethod; minutes_before: number }[];
}
