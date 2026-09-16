import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { MeetingsCtx } from "../lib/ctx";
import { requireWorkspace } from "../lib/require-workspace";
import { toSegmentDto } from "../lib/serialize";

interface SegmentInput {
	speaker_name: string;
	start_ms: number;
	end_ms?: number;
	text: string;
	language?: string;
	participant_id?: string;
	recording_id?: string;
}

interface AppendTranscriptBody {
	segments: SegmentInput[];
}

async function meetingInWorkspace(
	ctx: MeetingsCtx,
	meetingId: string,
	workspaceId: string,
): Promise<boolean> {
	const row = await ctx.db
		.selectFrom("mt_meetings")
		.select("id")
		.where("id", "=", meetingId)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
	return Boolean(row);
}

export function registerTranscriptRoutes(
	fastify: TwodbFastifyInstance,
	ctx: MeetingsCtx,
): void {
	fastify.get<{ Params: { meetingId: string } }>(
		"/meetings/:meetingId/transcript",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const segments = await ctx.db
				.selectFrom("mt_transcript_segments")
				.selectAll()
				.where("meeting_id", "=", request.params.meetingId)
				.orderBy("start_ms", "asc")
				.execute();
			return { segments: segments.map(toSegmentDto) };
		},
	);

	// Append-only: the scribe streams segments in as they finalize.
	fastify.post<{ Params: { meetingId: string }; Body: AppendTranscriptBody }>(
		"/meetings/:meetingId/transcript",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const inputs = request.body?.segments;
			if (
				!Array.isArray(inputs) ||
				inputs.length === 0 ||
				inputs.some(
					(s) =>
						!s?.speaker_name?.trim() ||
						!s?.text?.trim() ||
						typeof s?.start_ms !== "number",
				)
			) {
				return reply.code(400).send({
					error:
						"segments must be a non-empty array of { speaker_name, start_ms, text }.",
				});
			}

			const rows = await ctx.db
				.insertInto("mt_transcript_segments")
				.values(
					inputs.map((s) => ({
						id: newId("seg"),
						meeting_id: request.params.meetingId,
						recording_id: s.recording_id ?? null,
						participant_id: s.participant_id ?? null,
						speaker_name: s.speaker_name.trim(),
						start_ms: s.start_ms,
						end_ms: s.end_ms ?? null,
						text: s.text.trim(),
						language: s.language ?? "en",
					})),
				)
				.returningAll()
				.execute();

			const segments = rows.map(toSegmentDto);
			fastify.bus.emit("io.twodb.meetings.transcript.appended", {
				workspace_id: workspaceId,
				meeting_id: request.params.meetingId,
				segments,
			});
			return { segments };
		},
	);
}
