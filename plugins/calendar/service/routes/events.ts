import type {
	CalendarInstanceDto,
	CalendarRsvp,
	UpsertCalendarEventInput,
} from "@twodb/contracts";
import type { FastifyInstance } from "fastify";
import type { Kysely, Selectable } from "kysely";
import { newId } from "@twodb/shared-backend";
import type { CalendarDB, CalEventsTable } from "../db/schema";
import type { CalendarCtx } from "../lib/ctx";
import { assertValidRrule, expandOccurrences } from "../lib/recurrence";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toEventDto } from "../lib/serialize";

interface RangeQuery {
	from?: string;
	to?: string;
	/** Comma-separated calendar ids; defaults to all visible calendars. */
	calendars?: string;
	/** Include calendars the user hid in the UI. */
	include_hidden?: string;
}

interface RsvpBody {
	rsvp: CalendarRsvp;
}

function parseRange(
	query: RangeQuery,
): { from: Date; to: Date } | { error: string } {
	if (!query.from || !query.to) {
		return { error: "from and to query params are required (ISO dates)." };
	}
	const from = new Date(query.from);
	const to = new Date(query.to);
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
		return { error: "from and to must be valid ISO dates." };
	}
	if (to <= from) return { error: "to must be after from." };
	return { from, to };
}

async function loadChildren(db: Kysely<CalendarDB>, eventIds: string[]) {
	const [attendees, reminders] = await Promise.all([
		db
			.selectFrom("cal_event_attendees")
			.selectAll()
			.where("event_id", "in", eventIds)
			.execute(),
		db
			.selectFrom("cal_event_reminders")
			.selectAll()
			.where("event_id", "in", eventIds)
			.execute(),
	]);
	return { attendees, reminders };
}

function validateInput(
	input: UpsertCalendarEventInput,
): { error: string } | null {
	if (!input?.calendar_id) return { error: "calendar_id is required." };
	if (!input.title?.trim()) return { error: "title is required." };
	const start = new Date(input.start_at);
	const end = new Date(input.end_at);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		return { error: "start_at and end_at must be valid ISO dates." };
	}
	if (end <= start) return { error: "end_at must be after start_at." };
	if (input.rrule) {
		try {
			assertValidRrule(input.rrule);
		} catch {
			return { error: "rrule is not a valid RRULE string." };
		}
	}
	return null;
}

export function registerEventRoutes(
	fastify: FastifyInstance,
	ctx: CalendarCtx,
): void {
	/**
	 * Range query — expands recurring events into concrete instances.
	 * Series overlap is tested against the series anchor window; expansion
	 * then filters precisely.
	 */
	fastify.get<{ Querystring: RangeQuery }>(
		"/events",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const range = parseRange(request.query);
			if ("error" in range) {
				return reply.code(400).send({ error: range.error });
			}

			let calendarIds: string[];
			if (request.query.calendars) {
				calendarIds = request.query.calendars.split(",").filter(Boolean);
			} else {
				let calendarsQuery = ctx.db
					.selectFrom("cal_calendars")
					.select("id")
					.where("workspace_id", "=", workspaceId);
				if (request.query.include_hidden !== "true") {
					calendarsQuery = calendarsQuery.where("visible", "=", true);
				}
				calendarIds = (await calendarsQuery.execute()).map((c) => c.id);
			}
			if (calendarIds.length === 0) return { instances: [] };

			// Candidate rows: one-off events overlapping the range, plus every
			// recurring series anchored before the range end (expansion decides).
			const rows = await ctx.db
				.selectFrom("cal_events")
				.selectAll()
				.where("workspace_id", "=", workspaceId)
				.where("calendar_id", "in", calendarIds)
				.where((eb) =>
					eb.or([
						eb.and([
							eb("rrule", "is", null),
							eb("start_at", "<", range.to),
							eb("end_at", ">", range.from),
						]),
						eb.and([
							eb("rrule", "is not", null),
							eb("start_at", "<", range.to),
						]),
					]),
				)
				.execute();
			if (rows.length === 0) return { instances: [] };

			const { attendees, reminders } = await loadChildren(
				ctx.db,
				rows.map((r) => r.id),
			);

			const instances: CalendarInstanceDto[] = [];
			for (const row of rows) {
				const dto = toEventDto(
					row,
					attendees.filter((a) => a.event_id === row.id),
					reminders.filter((r) => r.event_id === row.id),
				);
				for (const occ of expandOccurrences(
					{
						start_at: row.start_at,
						end_at: row.end_at,
						rrule: row.rrule,
						exdates: dto.exdates,
					},
					range.from,
					range.to,
				)) {
					const { id, start_at: _s, end_at: _e, ...rest } = dto;
					instances.push({
						...rest,
						event_id: id,
						start_at: occ.start.toISOString(),
						end_at: occ.end.toISOString(),
						recurring: occ.recurring,
					});
				}
			}

			instances.sort((a, b) => a.start_at.localeCompare(b.start_at));
			return { instances };
		},
	);

	fastify.post<{ Body: UpsertCalendarEventInput }>(
		"/events",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const invalid = validateInput(request.body);
			if (invalid) return reply.code(400).send(invalid);
			const input = request.body;

			const calendar = await ctx.db
				.selectFrom("cal_calendars")
				.selectAll()
				.where("id", "=", input.calendar_id)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!calendar)
				return reply.code(404).send({ error: "Calendar not found." });
			if (calendar.read_only) {
				return reply.code(400).send({ error: "This calendar is read-only." });
			}

			const eventId = newId("evt");
			const row = await ctx.db
				.insertInto("cal_events")
				.values({
					id: eventId,
					calendar_id: calendar.id,
					workspace_id: workspaceId,
					remote_id: null,
					title: input.title.trim(),
					description: input.description ?? null,
					location: input.location ?? null,
					conferencing_url: input.conferencing_url ?? null,
					start_at: new Date(input.start_at),
					end_at: new Date(input.end_at),
					all_day: input.all_day ?? false,
					timezone: input.timezone ?? null,
					rrule: input.rrule ?? null,
					exdates: JSON.stringify(input.exdates ?? []),
					status: input.status ?? "confirmed",
					organizer_email: null,
					created_by: principalOf(request).userId,
				})
				.returningAll()
				.executeTakeFirstOrThrow();

			await replaceChildren(ctx.db, eventId, input);
			const { attendees, reminders } = await loadChildren(ctx.db, [eventId]);
			return { event: toEventDto(row, attendees, reminders) };
		},
	);

	fastify.get<{ Params: { eventId: string } }>(
		"/events/:eventId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const row = await ctx.db
				.selectFrom("cal_events")
				.selectAll()
				.where("id", "=", request.params.eventId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!row) return reply.code(404).send({ error: "Not found." });
			const { attendees, reminders } = await loadChildren(ctx.db, [row.id]);
			return { event: toEventDto(row, attendees, reminders) };
		},
	);

	fastify.patch<{
		Params: { eventId: string };
		Body: Partial<UpsertCalendarEventInput>;
	}>("/events/:eventId", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const input = request.body ?? {};

		const existing = await ctx.db
			.selectFrom("cal_events")
			.selectAll()
			.where("id", "=", request.params.eventId)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!existing) return reply.code(404).send({ error: "Not found." });

		const updates: Record<string, unknown> = { updated_at: new Date() };
		if (input.title !== undefined) updates.title = input.title.trim();
		if (input.description !== undefined)
			updates.description = input.description;
		if (input.location !== undefined) updates.location = input.location;
		if (input.conferencing_url !== undefined)
			updates.conferencing_url = input.conferencing_url;
		if (input.all_day !== undefined) updates.all_day = input.all_day;
		if (input.timezone !== undefined) updates.timezone = input.timezone;
		if (input.status !== undefined) updates.status = input.status;
		if (input.exdates !== undefined)
			updates.exdates = JSON.stringify(input.exdates);
		if (input.rrule !== undefined) {
			if (input.rrule) {
				try {
					assertValidRrule(input.rrule);
				} catch {
					return reply
						.code(400)
						.send({ error: "rrule is not a valid RRULE string." });
				}
			}
			updates.rrule = input.rrule;
		}
		if (input.start_at !== undefined || input.end_at !== undefined) {
			const start = new Date(input.start_at ?? existing.start_at.toISOString());
			const end = new Date(input.end_at ?? existing.end_at.toISOString());
			if (end <= start) {
				return reply
					.code(400)
					.send({ error: "end_at must be after start_at." });
			}
			updates.start_at = start;
			updates.end_at = end;
		}

		const row = await ctx.db
			.updateTable("cal_events")
			.set(updates)
			.where("id", "=", existing.id)
			.returningAll()
			.executeTakeFirstOrThrow();

		if (input.attendees !== undefined || input.reminders !== undefined) {
			await replaceChildren(ctx.db, existing.id, input);
		}
		const { attendees, reminders } = await loadChildren(ctx.db, [existing.id]);
		return { event: toEventDto(row, attendees, reminders) };
	});

	fastify.delete<{ Params: { eventId: string } }>(
		"/events/:eventId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			await ctx.db
				.deleteFrom("cal_events")
				.where("id", "=", request.params.eventId)
				.where("workspace_id", "=", workspaceId)
				.execute();
			return { ok: true };
		},
	);

	/**
	 * Answer an invitation.
	 * TODO: resolve the attendee from the authenticated principal's email
	 * (identity plugin) instead of taking attendeeId in the path.
	 */
	fastify.patch<{
		Params: { eventId: string; attendeeId: string };
		Body: RsvpBody;
	}>("/events/:eventId/attendees/:attendeeId/rsvp", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const rsvp = request.body?.rsvp;
		if (rsvp !== "accepted" && rsvp !== "declined" && rsvp !== "tentative") {
			return reply.code(400).send({
				error: "rsvp must be accepted, declined or tentative.",
			});
		}

		const row = await loadEvent(ctx.db, workspaceId, request.params.eventId);
		if (!row) return reply.code(404).send({ error: "Not found." });

		const updated = await ctx.db
			.updateTable("cal_event_attendees")
			.set({ rsvp })
			.where("id", "=", request.params.attendeeId)
			.where("event_id", "=", row.id)
			.returningAll()
			.executeTakeFirst();
		if (!updated) {
			return reply.code(404).send({ error: "Attendee not found." });
		}
		const { attendees, reminders } = await loadChildren(ctx.db, [row.id]);
		return { event: toEventDto(row, attendees, reminders) };
	});
}

async function loadEvent(
	db: Kysely<CalendarDB>,
	workspaceId: string,
	eventId: string,
): Promise<Selectable<CalEventsTable> | undefined> {
	return db
		.selectFrom("cal_events")
		.selectAll()
		.where("id", "=", eventId)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

async function replaceChildren(
	db: Kysely<CalendarDB>,
	eventId: string,
	input: Partial<UpsertCalendarEventInput>,
): Promise<void> {
	if (input.attendees !== undefined) {
		await db
			.deleteFrom("cal_event_attendees")
			.where("event_id", "=", eventId)
			.execute();
		for (const attendee of input.attendees) {
			await db
				.insertInto("cal_event_attendees")
				.values({
					id: newId("att"),
					event_id: eventId,
					email: attendee.email,
					name: attendee.name ?? null,
					role: attendee.role ?? "required",
				})
				.execute();
		}
	}
	if (input.reminders !== undefined) {
		await db
			.deleteFrom("cal_event_reminders")
			.where("event_id", "=", eventId)
			.execute();
		for (const reminder of input.reminders) {
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
}
