import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { AgentCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toThreadDto } from "../lib/serialize";

type ThreadParams = { id: string };

type ThreadBody = {
	thread_intent?: string | null;
	is_archived?: boolean;
};

type PromptBody = {
	text?: string;
	images?: unknown[];
};

const badRequest = (
	reply: { code: (n: number) => { send: (b: unknown) => unknown } },
	error: unknown,
) => reply.code(400).send({ error: (error as Error).message });

async function loadThread(ctx: AgentCtx, id: string, workspaceId: string) {
	return ctx.db
		.selectFrom("agent_threads")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

export function registerThreadRoutes(
	fastify: TwodbFastifyInstance,
	ctx: AgentCtx,
): void {
	fastify.get("/threads", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const includeArchived =
			(request.query as { archived?: string } | undefined)?.archived === "true";
		let query = ctx.db
			.selectFrom("agent_threads")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("updated_at", "desc");
		if (!includeArchived) query = query.where("is_archived", "=", false);
		const threads = await query.execute();
		return { threads: threads.map(toThreadDto) };
	});

	fastify.post("/threads", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = (request.body ?? {}) as {
			agent_id?: string;
			thread_intent?: string | null;
		};

		try {
			if (!body.agent_id) throw new Error("agent_id is required");
			const handle = await ctx.runtime.createNewThread({
				workspaceId,
				agentId: body.agent_id,
				threadIntent:
					typeof body.thread_intent === "string" ? body.thread_intent : null,
				createdBy: principalOf(request).userId,
			});
			const row = await ctx.db
				.selectFrom("agent_threads")
				.selectAll()
				.where("id", "=", handle.id)
				.executeTakeFirstOrThrow();
			return reply.code(201).send({
				thread: toThreadDto(row),
				info: await handle.info(),
			});
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.get("/threads/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const row = await loadThread(ctx, id, workspaceId);
		if (!row) return reply.code(404).send({ error: "thread not found" });
		return { thread: toThreadDto(row) };
	});

	fastify.patch("/threads/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const body = (request.body ?? {}) as ThreadBody;

		const existing = await loadThread(ctx, id, workspaceId);
		if (!existing) return reply.code(404).send({ error: "thread not found" });

		try {
			const updates: Record<string, unknown> = { updated_at: new Date() };
			if (body.thread_intent !== undefined) {
				updates.thread_intent =
					typeof body.thread_intent === "string" && body.thread_intent.trim()
						? body.thread_intent.trim()
						: null;
			}
			if (body.is_archived !== undefined) {
				if (typeof body.is_archived !== "boolean") {
					throw new Error("is_archived must be a boolean");
				}
				updates.is_archived = body.is_archived;
			}

			await ctx.db
				.updateTable("agent_threads")
				.set(updates)
				.where("id", "=", id)
				.execute();

			const row = await loadThread(ctx, id, workspaceId);
			fastify.bus.emit("io.twodb.agent.thread.updated", {
				workspace_id: workspaceId,
				thread: toThreadDto(row ?? existing),
			});
			return { thread: toThreadDto(row ?? existing) };
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.delete("/threads/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const result = await ctx.db
			.deleteFrom("agent_threads")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (result.numDeletedRows === 0n) {
			return reply.code(404).send({ error: "thread not found" });
		}
		fastify.bus.emit("io.twodb.agent.thread.deleted", {
			workspace_id: workspaceId,
			thread_id: id,
		});
		return { deleted: true };
	});

	fastify.get("/threads/:id/messages", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const thread = await loadThread(ctx, id, workspaceId);
		if (!thread) return reply.code(404).send({ error: "thread not found" });
		const query = (request.query ?? {}) as { before?: string; limit?: string };
		const before =
			query.before !== undefined && Number.isFinite(Number(query.before))
				? Number(query.before)
				: undefined;
		const limit =
			query.limit !== undefined && Number.isFinite(Number(query.limit))
				? Number(query.limit)
				: undefined;
		const messages = await ctx.runtime.listMessages(id, { before, limit });
		return { messages };
	});

	fastify.get("/threads/:id/messages/:messageId", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id, messageId } = request.params as {
			id: string;
			messageId: string;
		};
		const thread = await loadThread(ctx, id, workspaceId);
		if (!thread) return reply.code(404).send({ error: "thread not found" });
		const message = (await ctx.runtime.getMessage(messageId)) as
			| { thread_id: string }
			| undefined;
		if (!message || message.thread_id !== id) {
			return reply.code(404).send({ error: "message not found" });
		}
		return { message };
	});

	fastify.post("/threads/:id/compact", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const thread = await loadThread(ctx, id, workspaceId);
		if (!thread) return reply.code(404).send({ error: "thread not found" });
		if (ctx.runtime.isRunning(id)) {
			return reply.code(409).send({ error: "thread is running" });
		}
		try {
			await ctx.runtime.compactThread(id);
			return { compacted: true };
		} catch (error) {
			return reply.code(502).send({ error: (error as Error).message });
		}
	});

	fastify.post("/threads/:id/prompt", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const body = (request.body ?? {}) as PromptBody;

		const thread = await loadThread(ctx, id, workspaceId);
		if (!thread) return reply.code(404).send({ error: "thread not found" });
		if (typeof body.text !== "string" || body.text.trim().length === 0) {
			return badRequest(reply, new Error("text is required"));
		}
		if (ctx.runtime.isRunning(id)) {
			return reply.code(409).send({ error: "thread is already running" });
		}

		const handle = await ctx.runtime.getThread(id);
		if (!handle) return reply.code(404).send({ error: "thread not found" });

		try {
			const messages = await handle.prompt({
				text: body.text,
				images: body.images,
			});
			return { messages };
		} catch (error) {
			return reply.code(502).send({ error: (error as Error).message });
		}
	});

	fastify.post("/threads/:id/stop", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as ThreadParams;
		const thread = await loadThread(ctx, id, workspaceId);
		if (!thread) return reply.code(404).send({ error: "thread not found" });
		if (!ctx.runtime.isRunning(id)) {
			return reply.code(409).send({ error: "thread is not running" });
		}
		ctx.runtime.stop(id);
		return { stopped: true };
	});
}
