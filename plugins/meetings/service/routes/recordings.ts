import type { RecordingStatus, TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { MeetingsCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toRecordingDto } from "../lib/serialize";
import { RECORDING_KINDS, RECORDING_STATUSES } from "../../shared/constants";

interface StartRecordingBody {
	kind?: (typeof RECORDING_KINDS)[number];
}

interface PatchRecordingBody {
	/** stop = finalize the take; anything else just updates status/artifact. */
	action?: "stop";
	status?: RecordingStatus;
	storage_key?: string | null;
	size_bytes?: number | null;
}

async function meetingInWorkspace(
	ctx: MeetingsCtx,
	meetingId: string,
	workspaceId: string,
) {
	const meeting = await ctx.db
		.selectFrom("mt_meetings")
		.selectAll()
		.where("id", "=", meetingId)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
	return meeting ?? null;
}

export function registerRecordingRoutes(
	fastify: TwodbFastifyInstance,
	ctx: MeetingsCtx,
): void {
	// Workspace-level listing: every recording taken in this workspace,
	// across meetings (the "recordings library").
	fastify.get<{ Querystring: { status?: RecordingStatus } }>(
		"/recordings",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			let query = ctx.db
				.selectFrom("mt_recordings")
				.selectAll()
				.where("workspace_id", "=", workspaceId)
				.orderBy("created_at", "desc");
			const status = request.query.status;
			if (status && RECORDING_STATUSES.includes(status)) {
				query = query.where("status", "=", status);
			}
			const recordings = await query.execute();
			return { recordings: recordings.map(toRecordingDto) };
		},
	);

	fastify.get<{ Params: { meetingId: string } }>(
		"/meetings/:meetingId/recordings",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const recordings = await ctx.db
				.selectFrom("mt_recordings")
				.selectAll()
				.where("meeting_id", "=", request.params.meetingId)
				.orderBy("started_at", "asc")
				.execute();
			return { recordings: recordings.map(toRecordingDto) };
		},
	);

	fastify.post<{ Params: { meetingId: string }; Body: StartRecordingBody }>(
		"/meetings/:meetingId/recordings",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const meeting = await meetingInWorkspace(
				ctx,
				request.params.meetingId,
				workspaceId,
			);
			if (!meeting)
				return reply.code(404).send({ error: "Meeting not found." });
			if (meeting.status !== "live") {
				return reply
					.code(409)
					.send({ error: "Recordings can only start in a live meeting." });
			}
			const kind = request.body?.kind ?? "video";
			if (!RECORDING_KINDS.includes(kind)) {
				return reply.code(400).send({ error: "Invalid kind." });
			}

			const recording = await ctx.db
				.insertInto("mt_recordings")
				.values({
					id: newId("rec"),
					meeting_id: meeting.id,
					workspace_id: workspaceId,
					kind,
					started_by: principalOf(request).userId,
				})
				.returningAll()
				.executeTakeFirstOrThrow();

			const dto = toRecordingDto(recording);
			fastify.bus.emit("io.twodb.meetings.recording.started", {
				workspace_id: workspaceId,
				recording: dto,
			});
			return { recording: dto };
		},
	);

	fastify.patch<{
		Params: { meetingId: string; recordingId: string };
		Body: PatchRecordingBody;
	}>("/meetings/:meetingId/recordings/:recordingId", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		if (
			!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
		) {
			return reply.code(404).send({ error: "Meeting not found." });
		}
		const body = request.body ?? {};
		if (body.status && !RECORDING_STATUSES.includes(body.status)) {
			return reply.code(400).send({ error: "Invalid status." });
		}

		const existing = await ctx.db
			.selectFrom("mt_recordings")
			.selectAll()
			.where("id", "=", request.params.recordingId)
			.where("meeting_id", "=", request.params.meetingId)
			.executeTakeFirst();
		if (!existing) return reply.code(404).send({ error: "Not found." });

		const updates: Record<string, unknown> = { updated_at: new Date() };
		let stopped = false;
		if (body.action === "stop") {
			if (existing.status !== "recording") {
				return reply
					.code(409)
					.send({ error: `Recording is already ${existing.status}.` });
			}
			const endedAt = new Date();
			updates.status = "processing";
			updates.ended_at = endedAt;
			updates.duration_ms = Math.max(
				0,
				endedAt.getTime() - existing.started_at.getTime(),
			);
			stopped = true;
		}
		if (body.status !== undefined) updates.status = body.status;
		if (body.storage_key !== undefined) updates.storage_key = body.storage_key;
		if (body.size_bytes !== undefined) updates.size_bytes = body.size_bytes;

		const recording = await ctx.db
			.updateTable("mt_recordings")
			.set(updates)
			.where("id", "=", existing.id)
			.returningAll()
			.executeTakeFirstOrThrow();

		const dto = toRecordingDto(recording);
		if (stopped) {
			fastify.bus.emit("io.twodb.meetings.recording.stopped", {
				workspace_id: workspaceId,
				recording: dto,
			});
		}
		return { recording: dto };
	});

	fastify.delete<{ Params: { meetingId: string; recordingId: string } }>(
		"/meetings/:meetingId/recordings/:recordingId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const result = await ctx.db
				.deleteFrom("mt_recordings")
				.where("id", "=", request.params.recordingId)
				.where("meeting_id", "=", request.params.meetingId)
				.executeTakeFirst();
			if (!result.numDeletedRows) {
				return reply.code(404).send({ error: "Not found." });
			}
			return { ok: true };
		},
	);
}
