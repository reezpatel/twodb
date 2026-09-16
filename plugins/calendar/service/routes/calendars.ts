import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { CalendarCtx } from "../lib/ctx";
import { requireWorkspace } from "../lib/require-workspace";
import { toCalendarDto } from "../lib/serialize";

interface CreateCalendarBody {
	account_id: string;
	name: string;
	color?: string;
}

interface PatchCalendarBody {
	name?: string;
	color?: string | null;
	visible?: boolean;
	position?: number;
}

export function registerCalendarRoutes(
	fastify: FastifyInstance,
	ctx: CalendarCtx,
): void {
	fastify.get("/calendars", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const calendars = await ctx.db
			.selectFrom("cal_calendars")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("position", "asc")
			.orderBy("created_at", "asc")
			.execute();
		return { calendars: calendars.map(toCalendarDto) };
	});

	fastify.post<{ Body: CreateCalendarBody }>(
		"/calendars",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const body = request.body;
			if (!body?.account_id || !body.name?.trim()) {
				return reply
					.code(400)
					.send({ error: "account_id and name are required." });
			}

			const account = await ctx.db
				.selectFrom("cal_accounts")
				.selectAll()
				.where("id", "=", body.account_id)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!account)
				return reply.code(404).send({ error: "Account not found." });
			if (account.provider !== "local") {
				return reply.code(400).send({
					error: "Remote calendars are created at the provider and synced.",
				});
			}

			const calendar = await ctx.db
				.insertInto("cal_calendars")
				.values({
					id: newId("cal"),
					account_id: account.id,
					workspace_id: workspaceId,
					remote_id: null,
					name: body.name.trim(),
					color: body.color ?? null,
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			return { calendar: toCalendarDto(calendar) };
		},
	);

	fastify.patch<{ Params: { calendarId: string }; Body: PatchCalendarBody }>(
		"/calendars/:calendarId",
		async (request, reply) => {
			const workspaceId = requireWorkspace(request, reply);
			if (!workspaceId) return reply;
			const body = request.body ?? {};

			const updates: Record<string, unknown> = { updated_at: new Date() };
			if (body.name !== undefined) updates.name = body.name.trim();
			if (body.color !== undefined) updates.color = body.color;
			if (body.visible !== undefined) updates.visible = body.visible;
			if (body.position !== undefined) updates.position = body.position;

			const calendar = await ctx.db
				.updateTable("cal_calendars")
				.set(updates)
				.where("id", "=", request.params.calendarId)
				.where("workspace_id", "=", workspaceId)
				.returningAll()
				.executeTakeFirst();
			if (!calendar) return reply.code(404).send({ error: "Not found." });
			return { calendar: toCalendarDto(calendar) };
		},
	);

	fastify.delete<{ Params: { calendarId: string } }>(
		"/calendars/:calendarId",
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
			if (calendar.remote_id !== null) {
				return reply.code(400).send({
					error: "Disconnect the account to remove a synced calendar.",
				});
			}
			await ctx.db
				.deleteFrom("cal_calendars")
				.where("id", "=", calendar.id)
				.execute();
			return { ok: true };
		},
	);
}
