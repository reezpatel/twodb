import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { MeetingsCtx } from "../lib/ctx";
import { requireWorkspace } from "../lib/require-workspace";
import { toParticipantDto } from "../lib/serialize";
import { PARTICIPANT_ROLES, PARTICIPANT_STATES } from "../../shared/constants";

interface AddParticipantBody {
	name: string;
	email?: string;
	user_id?: string;
	role?: (typeof PARTICIPANT_ROLES)[number];
}

interface PatchParticipantBody {
	role?: (typeof PARTICIPANT_ROLES)[number];
	state?: (typeof PARTICIPANT_STATES)[number];
}

/** True when the meeting exists in this workspace (tenant guard). */
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

export function registerParticipantRoutes(
	fastify: TwodbFastifyInstance,
	ctx: MeetingsCtx,
): void {
	fastify.post<{ Params: { meetingId: string }; Body: AddParticipantBody }>(
		"/meetings/:meetingId/participants",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const body = request.body;
			if (!body?.name?.trim()) {
				return reply.code(400).send({ error: "name is required." });
			}
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			if (body.role && !PARTICIPANT_ROLES.includes(body.role)) {
				return reply.code(400).send({ error: "Invalid role." });
			}

			const participant = await ctx.db
				.insertInto("mt_meeting_participants")
				.values({
					id: newId("mtp"),
					meeting_id: request.params.meetingId,
					user_id: body.user_id ?? null,
					name: body.name.trim(),
					email: body.email ?? null,
					role: body.role ?? "participant",
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			return { participant: toParticipantDto(participant) };
		},
	);

	fastify.patch<{
		Params: { meetingId: string; participantId: string };
		Body: PatchParticipantBody;
	}>(
		"/meetings/:meetingId/participants/:participantId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const body = request.body ?? {};
			if (body.role && !PARTICIPANT_ROLES.includes(body.role)) {
				return reply.code(400).send({ error: "Invalid role." });
			}
			if (body.state && !PARTICIPANT_STATES.includes(body.state)) {
				return reply.code(400).send({ error: "Invalid state." });
			}

			const updates: Record<string, unknown> = {};
			if (body.role !== undefined) updates.role = body.role;
			if (body.state !== undefined) {
				updates.state = body.state;
				if (body.state === "joined") updates.joined_at = new Date();
				if (body.state === "left") updates.left_at = new Date();
			}

			const participant = await ctx.db
				.updateTable("mt_meeting_participants")
				.set(updates)
				.where("id", "=", request.params.participantId)
				.where("meeting_id", "=", request.params.meetingId)
				.returningAll()
				.executeTakeFirst();
			if (!participant) return reply.code(404).send({ error: "Not found." });
			return { participant: toParticipantDto(participant) };
		},
	);

	fastify.delete<{ Params: { meetingId: string; participantId: string } }>(
		"/meetings/:meetingId/participants/:participantId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const result = await ctx.db
				.deleteFrom("mt_meeting_participants")
				.where("id", "=", request.params.participantId)
				.where("meeting_id", "=", request.params.meetingId)
				.executeTakeFirst();
			if (!result.numDeletedRows) {
				return reply.code(404).send({ error: "Not found." });
			}
			return { ok: true };
		},
	);
}
