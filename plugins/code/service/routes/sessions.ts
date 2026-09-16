import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import {
	adjectives,
	animals,
	uniqueNamesGenerator,
} from "unique-names-generator";
import type { CodeCtx } from "../lib/ctx";
import { nodeExists } from "../lib/node";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { toSessionDto } from "../lib/serialize";
import { ensureThread, stopThread } from "../runtime/sessions";

type SessionParams = { id: string };

type SessionBody = {
	node_id?: string;
	cwd?: string;
	is_git?: boolean;
	agent_id?: string | null;
	title?: string | null;
	worktree_path?: string | null;
	archived?: boolean;
	/** "continue" keeps history, "direct" starts a fresh thread, "compact" summarizes it, "clear" wipes it (agent switch only) */
	mode?: "continue" | "compact" | "direct" | "clear";
};

type PromptBody = {
	text?: string;
	images?: unknown[];
};

const badRequest = (
	reply: { code: (n: number) => { send: (b: unknown) => unknown } },
	error: unknown,
) => reply.code(400).send({ error: (error as Error).message });

/** Live run state comes from the agent runtime, not the row. */
const isSessionRunning = (
	fastify: TwodbFastifyInstance,
	session: { thread_id: string | null },
): boolean =>
	session.thread_id != null &&
	(fastify.agents?.isRunning(session.thread_id) ?? false);

/** Memorable default titles ("Brave Falcon") when none is provided. */
const generateTitle = (): string =>
	uniqueNamesGenerator({
		dictionaries: [adjectives, animals],
		separator: " ",
		style: "capital",
	});

async function loadSession(ctx: CodeCtx, id: string, workspaceId: string) {
	return ctx.db
		.selectFrom("code_sessions")
		.selectAll()
		.where("id", "=", id)
		.where("workspace_id", "=", workspaceId)
		.executeTakeFirst();
}

export function registerSessionRoutes(
	fastify: TwodbFastifyInstance,
	ctx: CodeCtx,
): void {
	fastify.get("/sessions", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { cwd, archived } = (request.query ?? {}) as {
			cwd?: string;
			archived?: string;
		};
		let query = ctx.db
			.selectFrom("code_sessions")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("updated_at", "desc");
		query =
			archived === "true"
				? query.where("archived_at", "is not", null)
				: query.where("archived_at", "is", null);
		if (cwd) {
			query = query.where("cwd", "=", cwd);
		}
		const sessions = await query.execute();
		return {
			sessions: sessions.map((session) =>
				toSessionDto(session, isSessionRunning(fastify, session)),
			),
		};
	});

	fastify.post("/sessions", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const body = (request.body ?? {}) as SessionBody;

		try {
			if (!body.node_id) throw new Error("node_id is required");
			if (!(await nodeExists(fastify, body.node_id, workspaceId))) {
				throw new Error("node not found");
			}

			const id = newId("sess");
			await ctx.db
				.insertInto("code_sessions")
				.values({
					id,
					workspace_id: workspaceId,
					node_id: body.node_id,
					cwd:
						typeof body.cwd === "string" && body.cwd.trim()
							? body.cwd.trim()
							: ".",
					is_git: body.is_git === true,
					title:
						typeof body.title === "string" && body.title.trim()
							? body.title.trim()
							: generateTitle(),
					worktree_path:
						typeof body.worktree_path === "string" && body.worktree_path.trim()
							? body.worktree_path.trim()
							: null,
					agent_id:
						typeof body.agent_id === "string" && body.agent_id.trim()
							? body.agent_id.trim()
							: null,
					created_by: principalOf(request).userId,
				})
				.execute();

			let row = await loadSession(ctx, id, workspaceId);
			if (!row) return reply.code(500).send({ error: "insert failed" });

			// Create the backing thread eagerly when an agent is known.
			if (row.agent_id) {
				await ensureThread(fastify, ctx, row);
				row = (await loadSession(ctx, id, workspaceId)) ?? row;
			}
			return reply.code(201).send({ session: toSessionDto(row) });
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.get("/sessions/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as SessionParams;
		const row = await loadSession(ctx, id, workspaceId);
		if (!row) return reply.code(404).send({ error: "session not found" });
		return { session: toSessionDto(row, isSessionRunning(fastify, row)) };
	});

	fastify.patch("/sessions/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as SessionParams;
		const body = (request.body ?? {}) as SessionBody;

		const existing = await loadSession(ctx, id, workspaceId);
		if (!existing) return reply.code(404).send({ error: "session not found" });

		try {
			const updates: Record<string, unknown> = { updated_at: new Date() };
			if (body.title !== undefined) {
				updates.title =
					typeof body.title === "string" && body.title.trim()
						? body.title.trim()
						: null;
			}
			if (body.worktree_path !== undefined) {
				updates.worktree_path =
					typeof body.worktree_path === "string" && body.worktree_path.trim()
						? body.worktree_path.trim()
						: null;
			}
			if (body.node_id !== undefined) {
				if (!(await nodeExists(fastify, body.node_id, workspaceId))) {
					throw new Error("node not found");
				}
				updates.node_id = body.node_id;
			}
			if (body.cwd !== undefined) {
				if (typeof body.cwd !== "string" || body.cwd.trim().length === 0) {
					throw new Error("cwd cannot be empty");
				}
				updates.cwd = body.cwd.trim();
			}
			if (body.is_git !== undefined) updates.is_git = body.is_git === true;
			if (body.archived !== undefined) {
				updates.archived_at = body.archived === true ? new Date() : null;
			}
			if (body.agent_id !== undefined) {
				const nextAgentId =
					typeof body.agent_id === "string" && body.agent_id.trim()
						? body.agent_id.trim()
						: null;
				if (
					existing.thread_id &&
					nextAgentId &&
					nextAgentId !== existing.agent_id
				) {
					// Mid-chat agent switch: the mode decides history handling.
					// Same-thread modes also rebind the thread's agent row — the
					// runtime resolves the agent from the thread, not the session.
					if (body.mode !== undefined && body.mode !== "continue") {
						if (!fastify.agents) {
							throw new Error("agent plugin is not available");
						}
						if (fastify.agents.isRunning(existing.thread_id)) {
							throw new Error("session is running — stop it before switching");
						}
						if (body.mode === "compact") {
							await fastify.agents.compactThread(existing.thread_id);
						} else if (body.mode === "clear") {
							await fastify.agents.clearThread(existing.thread_id);
						} else if (body.mode === "direct") {
							const handle = await fastify.agents.createNewThread({
								workspaceId,
								agentId: nextAgentId,
								createdBy: principalOf(request).userId,
							});
							updates.thread_id = handle.id;
						}
					} else if (body.mode === undefined) {
						throw new Error(
							'mode is required when changing agent mid-session: "continue" keeps history, "direct" starts a fresh thread, "compact" summarizes first, "clear" wipes history',
						);
					}
					if (
						updates.thread_id === undefined &&
						fastify.agents &&
						!fastify.agents.isRunning(existing.thread_id)
					) {
						await fastify.agents.setThreadAgent(
							existing.thread_id,
							nextAgentId,
						);
					}
				}
				updates.agent_id = nextAgentId;
			}

			await ctx.db
				.updateTable("code_sessions")
				.set(updates)
				.where("id", "=", id)
				.execute();

			const row = (await loadSession(ctx, id, workspaceId)) ?? existing;
			return { session: toSessionDto(row, isSessionRunning(fastify, row)) };
		} catch (error) {
			return badRequest(reply, error);
		}
	});

	fastify.delete("/sessions/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as SessionParams;
		const result = await ctx.db
			.deleteFrom("code_sessions")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (result.numDeletedRows === 0n) {
			return reply.code(404).send({ error: "session not found" });
		}
		return { deleted: true };
	});

	fastify.post("/sessions/:id/prompt", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as SessionParams;
		const body = (request.body ?? {}) as PromptBody;

		const session = await loadSession(ctx, id, workspaceId);
		if (!session) return reply.code(404).send({ error: "session not found" });
		if (typeof body.text !== "string" || body.text.trim().length === 0) {
			return badRequest(reply, new Error("text is required"));
		}

		try {
			const handle = await ensureThread(fastify, ctx, session);
			const messages = await handle.prompt({
				text: body.text,
				images: body.images,
			});
			return { messages };
		} catch (error) {
			return reply.code(502).send({ error: (error as Error).message });
		}
	});

	fastify.post("/sessions/:id/stop", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as SessionParams;
		const session = await loadSession(ctx, id, workspaceId);
		if (!session) return reply.code(404).send({ error: "session not found" });
		const stopped = await stopThread(fastify, session);
		if (!stopped) {
			return reply.code(409).send({ error: "session is not running" });
		}
		return { stopped: true };
	});

	fastify.get("/sessions/:id/messages", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as SessionParams;
		const session = await loadSession(ctx, id, workspaceId);
		if (!session) return reply.code(404).send({ error: "session not found" });
		if (!session.thread_id || !fastify.agents) {
			return { messages: [] };
		}
		const query = (request.query ?? {}) as { before?: string; limit?: string };
		const before =
			query.before !== undefined && Number.isFinite(Number(query.before))
				? Number(query.before)
				: undefined;
		const limit =
			query.limit !== undefined && Number.isFinite(Number(query.limit))
				? Number(query.limit)
				: undefined;
		return {
			messages: await fastify.agents.listMessages(session.thread_id, {
				before,
				limit,
			}),
		};
	});

	fastify.get("/sessions/:id/messages/:messageId", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id, messageId } = request.params as {
			id: string;
			messageId: string;
		};
		const session = await loadSession(ctx, id, workspaceId);
		if (!session) return reply.code(404).send({ error: "session not found" });
		if (!session.thread_id || !fastify.agents) {
			return reply.code(404).send({ error: "message not found" });
		}
		const message = (await fastify.agents.getMessage(messageId)) as
			| { thread_id: string }
			| undefined;
		if (!message || message.thread_id !== session.thread_id) {
			return reply.code(404).send({ error: "message not found" });
		}
		return { message };
	});
}
