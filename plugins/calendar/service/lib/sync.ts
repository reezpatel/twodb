import { newId } from "@twodb/shared-backend";
import type { Kysely, Selectable } from "kysely";
import { connectorFor } from "../connectors";
import type { CalAccountsTable, CalendarDB } from "../db/schema";
import { CredentialBox, type CalendarCredentials } from "./crypto";
import type { IcsEvent } from "./ics";

/**
 * Pull every remote calendar of an account through its connector and upsert
 * the results into cal_events (keyed by remote_id). Local accounts are a
 * no-op. On failure the account is marked "error" and the error rethrown.
 */
export async function syncAccount(
	db: Kysely<CalendarDB>,
	credentialsKey: string | null,
	account: Selectable<CalAccountsTable>,
): Promise<{ calendars: number; events: number }> {
	const connector = connectorFor(account.provider);
	if (!connector) return { calendars: 0, events: 0 };

	try {
		let credentials: CalendarCredentials = {};
		if (account.credentials) {
			if (!credentialsKey)
				throw new Error("TWODB_CALENDAR_ENCRYPTION_KEY is not configured.");
			const box = new CredentialBox(credentialsKey);
			const decrypted = box.decrypt(account.credentials);
			if (!decrypted) throw new Error("Failed to decrypt credentials.");
			credentials = decrypted;

			if (
				connector.refresh &&
				credentials.expires_at &&
				credentials.expires_at < Date.now() + 60_000
			) {
				credentials = await connector.refresh(credentials);
				await db
					.updateTable("cal_accounts")
					.set({ credentials: box.encrypt(credentials) })
					.where("id", "=", account.id)
					.execute();
			}
		}

		// Ensure remote calendars are mirrored locally.
		const remoteCalendars = await connector.listCalendars(credentials, account);
		const existing = await db
			.selectFrom("cal_calendars")
			.selectAll()
			.where("account_id", "=", account.id)
			.execute();
		const byRemoteId = new Map(
			existing
				.filter((c) => c.remote_id !== null)
				.map((c) => [c.remote_id as string, c]),
		);

		let eventCount = 0;

		for (const remote of remoteCalendars) {
			let calendar = byRemoteId.get(remote.remote_id);
			if (!calendar) {
				calendar = await db
					.insertInto("cal_calendars")
					.values({
						id: newId("cal"),
						account_id: account.id,
						workspace_id: account.workspace_id,
						remote_id: remote.remote_id,
						name: remote.name,
						color: remote.color,
						read_only: remote.read_only,
						is_primary: remote.is_primary,
						visible: true,
						position: existing.length,
					})
					.returningAll()
					.executeTakeFirstOrThrow();
			}

			const result = await connector.pull(
				credentials,
				account,
				{ remote_id: remote.remote_id },
				account.sync_cursor,
			);

			for (const remoteId of result.deleted_remote_ids) {
				await db
					.deleteFrom("cal_events")
					.where("calendar_id", "=", calendar.id)
					.where("remote_id", "=", remoteId)
					.execute();
			}

			for (const event of result.events) {
				await upsertRemoteEvent(db, calendar.id, account, event);
				eventCount += 1;
			}

			if (result.cursor) {
				await db
					.updateTable("cal_accounts")
					.set({ sync_cursor: result.cursor })
					.where("id", "=", account.id)
					.execute();
			}
		}

		await db
			.updateTable("cal_accounts")
			.set({
				status: "active",
				error: null,
				last_synced_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", account.id)
			.execute();

		return { calendars: remoteCalendars.length, events: eventCount };
	} catch (error) {
		await db
			.updateTable("cal_accounts")
			.set({
				status: "error",
				error: error instanceof Error ? error.message : String(error),
				updated_at: new Date(),
			})
			.where("id", "=", account.id)
			.execute();
		throw error;
	}
}

async function upsertRemoteEvent(
	db: Kysely<CalendarDB>,
	calendarId: string,
	account: Selectable<CalAccountsTable>,
	event: IcsEvent,
): Promise<void> {
	const existing = await db
		.selectFrom("cal_events")
		.select("id")
		.where("calendar_id", "=", calendarId)
		.where("remote_id", "=", event.uid)
		.executeTakeFirst();

	const values = {
		title: event.title,
		description: event.description,
		location: event.location,
		conferencing_url: event.url,
		start_at: event.start_at,
		end_at: event.end_at,
		all_day: event.all_day,
		timezone: event.timezone,
		rrule: event.rrule,
		exdates: JSON.stringify(event.exdates),
		status: event.status,
		organizer_email: event.organizer_email,
		updated_at: new Date(),
	};

	let eventId: string;
	if (existing) {
		eventId = existing.id;
		await db
			.updateTable("cal_events")
			.set(values)
			.where("id", "=", eventId)
			.execute();
	} else {
		eventId = newId("evt");
		await db
			.insertInto("cal_events")
			.values({
				id: eventId,
				calendar_id: calendarId,
				workspace_id: account.workspace_id,
				remote_id: event.uid,
				etag: null,
				created_by: account.created_by,
				...values,
			})
			.execute();
	}

	// Attendees/reminders are replaced wholesale from the remote truth.
	await db
		.deleteFrom("cal_event_attendees")
		.where("event_id", "=", eventId)
		.execute();
	for (const attendee of event.attendees) {
		await db
			.insertInto("cal_event_attendees")
			.values({
				id: newId("att"),
				event_id: eventId,
				email: attendee.email,
				name: attendee.name,
				role: attendee.role,
				rsvp: attendee.rsvp,
			})
			.execute();
	}

	await db
		.deleteFrom("cal_event_reminders")
		.where("event_id", "=", eventId)
		.execute();
	for (const reminder of event.reminders) {
		await db
			.insertInto("cal_event_reminders")
			.values({
				id: newId("rem"),
				event_id: eventId,
				method: reminder.method,
				minutes_before: reminder.minutes_before,
			})
			.execute();
	}
}
