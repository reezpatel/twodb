import type {} from "@fastify/websocket";
import type {
	AgentThreadHandle,
	NodeStats,
	Principal,
	ThreadUsagePayload,
	TwodbFastifyInstance,
} from "@twodb/contracts";
import type { WebSocket } from "ws";
import type { CodeCtx } from "../lib/ctx";
import { toSessionDto } from "../lib/serialize";
import { ensureThread } from "../runtime/sessions";
import type { SessionRow } from "../runtime/sessions";

const STATS_INTERVAL_MS = 5_000;
const SNAPSHOT_PAGE_SIZE = 50;
const REPLAY_PAGE_SIZE = 200;

type ClientFrame = {
	type?: string;
	after_seq?: number;
	text?: string;
	images?: unknown[];
};

/**
 * Live session channel: the web opens one socket per selected session,
 * syncs state, then receives streamed message deltas, tool events, usage,
 * and node stats. Reconnects pass after_seq to replay what they missed.
 */
export function registerSessionStreamRoutes(
	fastify: TwodbFastifyInstance,
	ctx: CodeCtx,
): void {
	fastify.get("/sessions/:id/ws", { websocket: true }, (socket, request) => {
		void handleConnection(fastify, ctx, socket, request);
	});
}

async function handleConnection(
	fastify: TwodbFastifyInstance,
	ctx: CodeCtx,
	socket: WebSocket,
	request: { principal?: unknown; params?: unknown },
): Promise<void> {
	const principal = request.principal as Principal | null | undefined;
	if (!principal?.userId) {
		socket.close(4401, "unauthenticated");
		return;
	}
	if (!principal.workspaceId || !principal.isWorkspaceMember) {
		socket.close(4403, "no workspace");
		return;
	}
	const workspaceId = principal.workspaceId;
	const { id } = (request.params ?? {}) as { id?: string };

	const found = id
		? await ctx.db
				.selectFrom("code_sessions")
				.selectAll()
				.where("id", "=", id)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst()
		: undefined;
	if (!found) {
		socket.close(4404, "session not found");
		return;
	}
	let session: SessionRow = found;

	const send = (type: string, payload: Record<string, unknown> = {}) => {
		if (socket.readyState === socket.OPEN) {
			socket.send(JSON.stringify({ type, ...payload }));
		}
	};

	// --- thread event relay -------------------------------------------------
	let relayedThreadId: string | null = null;
	let unsubscribes: (() => void)[] = [];
	let updateFrames = 0;

	const relayThread = async (): Promise<AgentThreadHandle | null> => {
		if (!fastify.agents || !session.thread_id) return null;
		const handle = await fastify.agents.getThread(session.thread_id);
		if (!handle) return null;
		if (relayedThreadId === handle.id) return handle;
		for (const unsubscribe of unsubscribes) unsubscribe();
		unsubscribes = [
			handle.on("message-start", (p) => send("message-start", p)),
			handle.on("message-update", (p) => {
				updateFrames += 1;
				send("message-update", p);
			}),
			handle.on("message", (p) => send("message-end", p)),
			handle.on("tool-start", (p) => send("tool-start", p)),
			handle.on("tool-args", (p) => send("tool-args", p)),
			handle.on("tool-update", (p) => send("tool-update", p)),
			handle.on("tool-end", (p) => send("tool-end", p)),
			handle.on("usage", (p) => send("usage", p)),
			handle.on("run-finished", () => send("run-state", { running: false })),
			handle.on("run-failed", (p) =>
				send("run-state", { running: false, error: p.error }),
			),
			handle.on("compacted", () => send("compacted")),
		];
		relayedThreadId = handle.id;
		fastify.log.info(
			{ threadId: session.thread_id },
			"session relay subscribed",
		);
		return handle;
	};

	const reloadSession = async (): Promise<void> => {
		const fresh = await ctx.db
			.selectFrom("code_sessions")
			.selectAll()
			.where("id", "=", session.id)
			.executeTakeFirst();
		if (fresh) session = fresh;
	};

	const sendSnapshot = async (afterSeq?: number): Promise<void> => {
		await relayThread();
		let messages: unknown[] = [];
		let running = false;
		let usage: ThreadUsagePayload | null = null;
		if (session.thread_id && fastify.agents) {
			running = fastify.agents.isRunning(session.thread_id);
			messages =
				afterSeq !== undefined
					? await fastify.agents.listMessages(session.thread_id, {
							after: afterSeq,
							limit: REPLAY_PAGE_SIZE,
						})
					: await fastify.agents.listMessages(session.thread_id, {
							limit: SNAPSHOT_PAGE_SIZE,
						});
			usage = usageFromMessages(messages, running);
		}
		send("snapshot", {
			session: toSessionDto(session, running),
			running,
			messages,
			usage,
			incremental: afterSeq !== undefined,
		});
	};

	// --- node stats tick ------------------------------------------------------
	const pushStats = async (): Promise<void> => {
		if (!fastify.nodeStats) return;
		try {
			const stats: NodeStats | undefined = await fastify.nodeStats(
				session.node_id,
			);
			if (stats) send("stats", { stats });
		} catch {
			// stats are best-effort; a tick failure never kills the socket
		}
	};
	const statsTimer = setInterval(() => void pushStats(), STATS_INTERVAL_MS);
	statsTimer.unref?.();

	socket.on("message", (raw: WebSocket.RawData) => {
		let frame: ClientFrame;
		try {
			frame = JSON.parse(raw.toString()) as ClientFrame;
		} catch {
			send("error", { error: "malformed frame" });
			return;
		}

		if (frame.type === "sync") {
			void sendSnapshot(
				typeof frame.after_seq === "number" ? frame.after_seq : undefined,
			).catch((error: Error) => send("error", { error: error.message }));
			return;
		}

		if (frame.type === "stop") {
			if (session.thread_id && fastify.agents) {
				fastify.agents.stop(session.thread_id);
			}
			return;
		}

		if (frame.type === "prompt") {
			const text = typeof frame.text === "string" ? frame.text.trim() : "";
			if (!text) {
				send("error", { error: "text is required" });
				return;
			}
			void (async () => {
				const handle = await ensureThread(fastify, ctx, session);
				if (!session.thread_id) {
					// Thread was just created — reload + start relaying its events.
					await reloadSession();
				}
				await relayThread();
				send("run-state", { running: true });
				await handle.prompt({ text, images: frame.images });
				fastify.log.info(
					{ threadId: session.thread_id, updateFrames },
					"prompt finished — message-update frames relayed",
				);
			})().catch((error: Error) => send("error", { error: error.message }));
			return;
		}

		send("error", { error: `unknown frame type "${frame.type ?? ""}"` });
	});

	socket.on("close", () => {
		clearInterval(statsTimer);
		for (const unsubscribe of unsubscribes) unsubscribe();
	});

	// Initial state: snapshot + immediate stats tick.
	try {
		await sendSnapshot();
		await pushStats();
	} catch (error) {
		send("error", { error: (error as Error).message });
	}
}

/** Usage-so-far for the snapshot: last assistant message's usage wins. */
function usageFromMessages(
	messages: unknown[],
	running: boolean,
): ThreadUsagePayload | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = (messages[i] as { message?: Record<string, unknown> })
			?.message;
		if (!message || message.role !== "assistant") continue;
		const usage = message.usage as
			| { input?: number; output?: number; cacheRead?: number }
			| undefined;
		if (!usage) continue;
		return {
			input_tokens: usage.input ?? 0,
			output_tokens: usage.output ?? 0,
			context_tokens:
				(usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.output ?? 0),
			tokens_per_second: null,
			running,
		};
	}
	return null;
}
