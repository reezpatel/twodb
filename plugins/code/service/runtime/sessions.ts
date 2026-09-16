import type { Selectable } from "kysely";
import type { AgentThreadHandle, TwodbFastifyInstance } from "@twodb/contracts";
import type { CodeDB } from "../db/schema";
import type { CodeCtx } from "../lib/ctx";
import { buildNodeTools } from "./tools";

export type SessionRow = Selectable<CodeDB["code_sessions"]>;

const requireInvoke = (fastify: TwodbFastifyInstance) => {
	if (!fastify.nodeInvoke) {
		throw new Error("node invoke is not available");
	}
	return fastify.nodeInvoke;
};

const requireRuntime = (fastify: TwodbFastifyInstance) => {
	if (!fastify.agents) {
		throw new Error("agent thread runtime is not available");
	}
	return fastify.agents;
};

function registerSessionTools(
	fastify: TwodbFastifyInstance,
	session: SessionRow,
	handle: AgentThreadHandle,
): void {
	const cwd = session.worktree_path?.trim() || session.cwd;
	handle.registerTools(
		buildNodeTools(requireInvoke(fastify), session.node_id, cwd),
	);
}

/**
 * Resolve the session's agent-plugin thread, creating it lazily from the
 * session's agent_id if needed. Tools are re-registered on every call so
 * session edits (node, cwd) and worktree overrides take effect on the
 * next prompt (registration upserts by tool name).
 */
export async function ensureThread(
	fastify: TwodbFastifyInstance,
	ctx: CodeCtx,
	session: SessionRow,
): Promise<AgentThreadHandle> {
	const runtime = requireRuntime(fastify);

	if (session.thread_id) {
		const handle = await runtime.getThread(session.thread_id);
		if (handle) {
			registerSessionTools(fastify, session, handle);
			return handle;
		}
	}

	if (!session.agent_id) {
		throw new Error(
			"session has no agent configured — set agent_id (or pass it at creation)",
		);
	}

	const handle = await runtime.createNewThread({
		workspaceId: session.workspace_id,
		agentId: session.agent_id,
		threadIntent: session.title?.trim() || session.cwd,
	});
	registerSessionTools(fastify, session, handle);

	await ctx.db
		.updateTable("code_sessions")
		.set({ thread_id: handle.id, updated_at: new Date() })
		.where("id", "=", session.id)
		.execute();

	return handle;
}

export async function stopThread(
	fastify: TwodbFastifyInstance,
	session: SessionRow,
): Promise<boolean> {
	if (!session.thread_id || !fastify.agents) return false;
	const handle = await fastify.agents.getThread(session.thread_id);
	return handle?.stop() ?? false;
}
