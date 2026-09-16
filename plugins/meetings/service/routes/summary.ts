import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { MeetingsCtx } from "../lib/ctx";
import { requireWorkspace } from "../lib/require-workspace";
import { toSummaryDto } from "../lib/serialize";

interface PutSummaryBody {
	overview: string;
	key_points?: string[];
	action_items?: { text: string; assignee?: string | null }[];
	model?: string;
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

export function registerSummaryRoutes(
	fastify: TwodbFastifyInstance,
	ctx: MeetingsCtx,
): void {
	fastify.get<{ Params: { meetingId: string } }>(
		"/meetings/:meetingId/summary",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const summary = await ctx.db
				.selectFrom("mt_meeting_summaries")
				.selectAll()
				.where("meeting_id", "=", request.params.meetingId)
				.executeTakeFirst();
			if (!summary) return reply.code(404).send({ error: "No summary yet." });
			return { summary: toSummaryDto(summary) };
		},
	);

	// Upsert — the summarizer (or a human editor) replaces the whole document.
	fastify.put<{ Params: { meetingId: string }; Body: PutSummaryBody }>(
		"/meetings/:meetingId/summary",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			if (
				!(await meetingInWorkspace(ctx, request.params.meetingId, workspaceId))
			) {
				return reply.code(404).send({ error: "Meeting not found." });
			}
			const body = request.body;
			if (!body?.overview?.trim()) {
				return reply.code(400).send({ error: "overview is required." });
			}

			const now = new Date();
			const summary = await ctx.db
				.insertInto("mt_meeting_summaries")
				.values({
					meeting_id: request.params.meetingId,
					overview: body.overview.trim(),
					key_points: JSON.stringify(body.key_points ?? []),
					action_items: JSON.stringify(body.action_items ?? []),
					model: body.model ?? null,
				})
				.onConflict((oc) =>
					oc.column("meeting_id").doUpdateSet({
						overview: body.overview!.trim(),
						key_points: JSON.stringify(body.key_points ?? []),
						action_items: JSON.stringify(body.action_items ?? []),
						model: body.model ?? null,
						updated_at: now,
					}),
				)
				.returningAll()
				.executeTakeFirstOrThrow();

			const dto = toSummaryDto(summary);
			fastify.bus.emit("io.twodb.meetings.summary.generated", {
				workspace_id: workspaceId,
				summary: dto,
			});
			return { summary: dto };
		},
	);
}
