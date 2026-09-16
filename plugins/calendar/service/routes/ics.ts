import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { CalendarCtx } from "../lib/ctx";
import { buildIcs, parseIcs } from "../lib/ics";
import { principalOf, requireWorkspace } from "../lib/require-workspace";

interface ImportBody {
	calendar_id: string;
	/** Raw .ics text. */
	ics: string;
}

export function registerIcsRoutes(
	fastify: FastifyInstance,
	ctx: CalendarCtx,
): void {
	/** Import an .ics payload into a writable local calendar. */
	fastify.post<{ Body: ImportBody }>("/ics/import", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = request.body;
		if (!body?.calendar_id || !body.ics) {
			return reply
				.code(400)
				.send({ error: "calendar_id and ics are required." });
		}

		const calendar = await ctx.db
			.selectFrom("cal_calendars")
			.selectAll()
			.where("id", "=", body.calendar_id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!calendar)
			return reply.code(404).send({ error: "Calendar not found." });
		if (calendar.read_only) {
			return reply.code(400).send({ error: "This calendar is read-only." });
		}

		const events = parseIcs(body.ics);
		let imported = 0;
		for (const event of events) {
			const existing = await ctx.db
				.selectFrom("cal_events")
				.select("id")
				.where("calendar_id", "=", calendar.id)
				.where("remote_id", "=", event.uid)
				.executeTakeFirst();
			if (existing) continue;

			const eventId = newId("evt");
			await ctx.db
				.insertInto("cal_events")
				.values({
					id: eventId,
					calendar_id: calendar.id,
					workspace_id: workspaceId,
					remote_id: event.uid,
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
					created_by: principalOf(request).userId,
				})
				.execute();

			for (const attendee of event.attendees) {
				await ctx.db
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
			for (const reminder of event.reminders) {
				await ctx.db
					.insertInto("cal_event_reminders")
					.values({
						id: newId("rem"),
						event_id: eventId,
						method: reminder.method,
						minutes_before: reminder.minutes_before,
					})
					.execute();
			}
			imported += 1;
		}

		return { imported, total: events.length };
	});

	/** Export a whole calendar as .ics. */
	fastify.get<{ Params: { calendarId: string } }>(
		"/calendars/:calendarId/export",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;

			const calendar = await ctx.db
				.selectFrom("cal_calendars")
				.selectAll()
				.where("id", "=", request.params.calendarId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!calendar) return reply.code(404).send({ error: "Not found." });

			const rows = await ctx.db
				.selectFrom("cal_events")
				.selectAll()
				.where("calendar_id", "=", calendar.id)
				.orderBy("start_at", "asc")
				.execute();
			const attendees = rows.length
				? await ctx.db
						.selectFrom("cal_event_attendees")
						.selectAll()
						.where(
							"event_id",
							"in",
							rows.map((r) => r.id),
						)
						.execute()
				: [];
			const reminders = rows.length
				? await ctx.db
						.selectFrom("cal_event_reminders")
						.selectAll()
						.where(
							"event_id",
							"in",
							rows.map((r) => r.id),
						)
						.execute()
				: [];

			const ics = buildIcs(
				calendar.name,
				rows.map((row) => ({
					uid: row.remote_id ?? row.id,
					title: row.title,
					description: row.description,
					location: row.location,
					url: row.conferencing_url,
					start_at: row.start_at,
					end_at: row.end_at,
					all_day: row.all_day,
					timezone: row.timezone,
					rrule: row.rrule,
					exdates: Array.isArray(row.exdates) ? (row.exdates as string[]) : [],
					status: row.status,
					organizer_email: row.organizer_email,
					attendees: attendees
						.filter((a) => a.event_id === row.id)
						.map((a) => ({
							email: a.email,
							name: a.name,
							role: a.role,
							rsvp: a.rsvp,
						})),
					reminders: reminders
						.filter((r) => r.event_id === row.id)
						.map((r) => ({
							method: r.method,
							minutes_before: r.minutes_before,
						})),
				})),
			);

			return reply
				.header("content-type", "text/calendar; charset=utf-8")
				.header(
					"content-disposition",
					`attachment; filename="${calendar.name.replace(/[^\w-]+/g, "_")}.ics"`,
				)
				.send(ics);
		},
	);
}
