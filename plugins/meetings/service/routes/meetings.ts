import type { MeetingStatus, TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { MeetingsCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import {
	toMeetingDto,
	toParticipantDto,
	toRecordingDto,
	toSummaryDto,
} from "../lib/serialize";
import { MEETING_STATUSES } from "../../shared/constants";

interface CreateMeetingBody {
	title: string;
	context?: string;
	scheduled_start?: string;
	/** Start immediately instead of scheduling for later. */
	start_now?: boolean;
}

interface PatchMeetingBody {
	title?: string;
	context?: string | null;
	scheduled_start?: string | null;
	/** Status transitions go through start/end/cancel actions. */
	action?: "start" | "end" | "cancel";
}

export function registerMeetingRoutes(
	fastify: TwodbFastifyInstance,
	ctx: MeetingsCtx,
): void {
	fastify.get<{ Querystring: { status?: MeetingStatus } }>(
		"/meetings",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;

			let query = ctx.db
				.selectFrom("mt_meetings")
				.selectAll()
				.where("workspace_id", "=", workspaceId)
				.orderBy("created_at", "desc");
			const status = request.query.status;
			if (status && MEETING_STATUSES.includes(status)) {
				query = query.where("status", "=", status);
			}
			const meetings = await query.execute();
			return { meetings: meetings.map(toMeetingDto) };
		},
	);

	fastify.post<{ Body: CreateMeetingBody }>(
		"/meetings",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const body = request.body;
			if (!body?.title?.trim()) {
				return reply.code(400).send({ error: "title is required." });
			}

			const live = body.start_now === true;
			const meeting = await ctx.db
				.insertInto("mt_meetings")
				.values({
					id: newId("mtg"),
					workspace_id: workspaceId,
					title: body.title.trim(),
					context: body.context?.trim() || null,
					status: live ? "live" : "scheduled",
					scheduled_start:
						!live && body.scheduled_start
							? new Date(body.scheduled_start)
							: null,
					started_at: live ? new Date() : null,
					created_by: principalOf(request).userId,
				})
				.returningAll()
				.executeTakeFirstOrThrow();

			const dto = toMeetingDto(meeting);
			fastify.bus.emit("io.twodb.meetings.meeting.created", {
				workspace_id: workspaceId,
				meeting: dto,
			});
			return { meeting: dto };
		},
	);

	fastify.get<{ Params: { meetingId: string } }>(
		"/meetings/:meetingId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;

			const meeting = await ctx.db
				.selectFrom("mt_meetings")
				.selectAll()
				.where("id", "=", request.params.meetingId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!meeting) return reply.code(404).send({ error: "Not found." });

			const [participants, recordings, summary] = await Promise.all([
				ctx.db
					.selectFrom("mt_meeting_participants")
					.selectAll()
					.where("meeting_id", "=", meeting.id)
					.execute(),
				ctx.db
					.selectFrom("mt_recordings")
					.selectAll()
					.where("meeting_id", "=", meeting.id)
					.orderBy("started_at", "asc")
					.execute(),
				ctx.db
					.selectFrom("mt_meeting_summaries")
					.selectAll()
					.where("meeting_id", "=", meeting.id)
					.executeTakeFirst(),
			]);

			return {
				meeting: toMeetingDto(meeting),
				participants: participants.map(toParticipantDto),
				recordings: recordings.map(toRecordingDto),
				summary: summary ? toSummaryDto(summary) : null,
			};
		},
	);

	fastify.patch<{ Params: { meetingId: string }; Body: PatchMeetingBody }>(
		"/meetings/:meetingId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const body = request.body ?? {};

			const existing = await ctx.db
				.selectFrom("mt_meetings")
				.selectAll()
				.where("id", "=", request.params.meetingId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!existing) return reply.code(404).send({ error: "Not found." });

			const updates: Record<string, unknown> = { updated_at: new Date() };
			if (body.title !== undefined) updates.title = body.title.trim();
			if (body.context !== undefined) updates.context = body.context;
			if (body.scheduled_start !== undefined) {
				updates.scheduled_start = body.scheduled_start
					? new Date(body.scheduled_start)
					: null;
			}

			if (body.action === "start") {
				if (existing.status !== "scheduled") {
					return reply
						.code(409)
						.send({ error: `Cannot start a ${existing.status} meeting.` });
				}
				updates.status = "live";
				updates.started_at = new Date();
			} else if (body.action === "end") {
				if (existing.status !== "live") {
					return reply
						.code(409)
						.send({ error: `Cannot end a ${existing.status} meeting.` });
				}
				updates.status = "ended";
				updates.ended_at = new Date();
			} else if (body.action === "cancel") {
				if (existing.status === "ended") {
					return reply
						.code(409)
						.send({ error: "Cannot cancel an ended meeting." });
				}
				updates.status = "cancelled";
			}

			const meeting = await ctx.db
				.updateTable("mt_meetings")
				.set(updates)
				.where("id", "=", existing.id)
				.returningAll()
				.executeTakeFirstOrThrow();

			const dto = toMeetingDto(meeting);
			fastify.bus.emit("io.twodb.meetings.meeting.updated", {
				workspace_id: workspaceId,
				meeting: dto,
			});
			return { meeting: dto };
		},
	);

	fastify.delete<{ Params: { meetingId: string } }>(
		"/meetings/:meetingId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const result = await ctx.db
				.deleteFrom("mt_meetings")
				.where("id", "=", request.params.meetingId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!result.numDeletedRows) {
				return reply.code(404).send({ error: "Not found." });
			}
			return { ok: true };
		},
	);
}
