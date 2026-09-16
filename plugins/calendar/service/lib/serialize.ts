import type {
	CalendarAccountDto,
	CalendarAttendeeDto,
	CalendarDto,
	CalendarEventDto,
	CalendarReminderDto,
} from "@twodb/contracts";
import type { Selectable } from "kysely";
import type {
	CalAccountsTable,
	CalCalendarsTable,
	CalEventAttendeesTable,
	CalEventRemindersTable,
	CalEventsTable,
} from "../db/schema";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Account rows never leak the credentials blob into DTOs. */
export function toAccountDto(
	row: Selectable<CalAccountsTable>,
): CalendarAccountDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		provider: row.provider,
		label: row.label,
		email: row.email,
		status: row.status,
		sync_cursor: row.sync_cursor,
		last_synced_at: iso(row.last_synced_at),
		error: row.error,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toCalendarDto(row: Selectable<CalCalendarsTable>): CalendarDto {
	return {
		id: row.id,
		account_id: row.account_id,
		workspace_id: row.workspace_id,
		remote_id: row.remote_id,
		name: row.name,
		color: row.color,
		read_only: row.read_only,
		is_primary: row.is_primary,
		visible: row.visible,
		position: row.position,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toAttendeeDto(
	row: Selectable<CalEventAttendeesTable>,
): CalendarAttendeeDto {
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		role: row.role,
		rsvp: row.rsvp,
	};
}

export function toReminderDto(
	row: Selectable<CalEventRemindersTable>,
): CalendarReminderDto {
	return {
		id: row.id,
		method: row.method,
		minutes_before: row.minutes_before,
	};
}

export function toEventDto(
	row: Selectable<CalEventsTable>,
	attendees: Selectable<CalEventAttendeesTable>[] = [],
	reminders: Selectable<CalEventRemindersTable>[] = [],
): CalendarEventDto {
	return {
		id: row.id,
		calendar_id: row.calendar_id,
		workspace_id: row.workspace_id,
		remote_id: row.remote_id,
		etag: row.etag,
		title: row.title,
		description: row.description,
		location: row.location,
		conferencing_url: row.conferencing_url,
		start_at: row.start_at.toISOString(),
		end_at: row.end_at.toISOString(),
		all_day: row.all_day,
		timezone: row.timezone,
		rrule: row.rrule,
		exdates: Array.isArray(row.exdates) ? (row.exdates as string[]) : [],
		status: row.status,
		organizer_email: row.organizer_email,
		attendees: attendees.map(toAttendeeDto),
		reminders: reminders.map(toReminderDto),
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}
