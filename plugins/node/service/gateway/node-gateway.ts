import type {} from "@fastify/websocket";
import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { Kysely } from "kysely";
import type { WebSocket } from "ws";
import type { NodeDB } from "../db/schema";
import { hashSecret } from "../lib/secrets";
import { jsonb } from "../lib/serialize";
import type {
	NodeHeartbeatDetails,
	NodeIncomingMessage,
	NodeMeta,
	NodeResponseMessage,
	NodeStreamMessage,
} from "../../shared/types";

const HELLO_TIMEOUT_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export type CallNodeOptions = {
	timeoutMs?: number;
	onStream?: (stream: "stdout" | "stderr", chunk: string) => void;
	signal?: AbortSignal;
};

type PendingRequest = {
	resolve: (data: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
	onStream?: CallNodeOptions["onStream"];
};

/**
 * Owns the websocket endpoint node agents dial into and the live
 * nodeId → socket registry. Auth is secret-based (not session): the agent
 * proves its identity with the plaintext secret in its hello message.
 */
export class NodeGateway {
	private readonly sockets = new Map<string, WebSocket>();
	private readonly pending = new Map<string, PendingRequest>();
	private requestSeq = 0;

	constructor(private readonly db: Kysely<NodeDB>) {}

	isOnline(nodeId: string): boolean {
		return this.sockets.has(nodeId);
	}

	/**
	 * Dispatch an action to a node agent and await its response. Streaming
	 * chunks (run_command stdout/stderr) surface through `onStream` while the
	 * promise is pending. Timed-out or aborted `run_command` requests also
	 * send a best-effort `cancel_command` so the remote process is reaped.
	 */
	async callNode(
		nodeId: string,
		action: string,
		payload?: unknown,
		options?: CallNodeOptions,
	): Promise<unknown> {
		const socket = this.sockets.get(nodeId);
		if (!socket || socket.readyState !== socket.OPEN) {
			throw new Error(`node ${nodeId} is not connected`);
		}

		const id = `nreq-${++this.requestSeq}-${Date.now().toString(36)}`;
		const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

		return new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.failRequest(
					id,
					new Error(`node request "${action}" timed out after ${timeoutMs}ms`),
				);
				this.sendCancel(nodeId, id, action);
			}, timeoutMs);

			const pending: PendingRequest = {
				resolve,
				reject,
				timer,
				onStream: options?.onStream,
			};
			this.pending.set(id, pending);

			options?.signal?.addEventListener(
				"abort",
				() => {
					this.failRequest(id, new Error(`node request "${action}" aborted`));
					this.sendCancel(nodeId, id, action);
				},
				{ once: true },
			);

			const sent = this.sendToNode(nodeId, {
				v: 1,
				kind: "request",
				id,
				action,
				payload,
			});
			if (!sent) {
				this.failRequest(id, new Error(`node ${nodeId} is not connected`));
			}
		});
	}

	private settleRequest(
		id: string,
		run: (pending: PendingRequest) => void,
	): void {
		const pending = this.pending.get(id);
		if (!pending) return;
		this.pending.delete(id);
		clearTimeout(pending.timer);
		run(pending);
	}

	private failRequest(id: string, error: Error): void {
		this.settleRequest(id, (pending) => pending.reject(error));
	}

	private sendCancel(nodeId: string, requestId: string, action: string): void {
		if (action !== "run_command") return;
		this.sendToNode(nodeId, {
			v: 1,
			kind: "request",
			id: `cancel-${requestId}`,
			action: "cancel_command",
			payload: { targetId: requestId },
		});
	}

	private failAllPending(reason: string): void {
		for (const id of [...this.pending.keys()]) {
			this.failRequest(id, new Error(reason));
		}
	}

	sendToNode(nodeId: string, message: unknown): boolean {
		const socket = this.sockets.get(nodeId);
		if (!socket || socket.readyState !== socket.OPEN) return false;
		socket.send(JSON.stringify(message));
		return true;
	}

	disconnect(nodeId: string, code = 4000, reason = "node deleted"): void {
		const socket = this.sockets.get(nodeId);
		if (socket) socket.close(code, reason);
		this.sockets.delete(nodeId);
	}

	registerRoutes(fastify: TwodbFastifyInstance): void {
		fastify.get(
			"/nodes/ws",
			{ websocket: true, config: { public: true } },
			(socket, request) => this.onConnection(socket, request.log),
		);
	}

	private onConnection(
		socket: WebSocket,
		log: { info: (msg: string) => void; warn: (msg: string) => void },
	): void {
		let nodeId: string | null = null;
		const helloTimer = setTimeout(() => {
			if (!nodeId) socket.close(4401, "hello timeout");
		}, HELLO_TIMEOUT_MS);

		socket.on("message", (raw: WebSocket.RawData) => {
			void this.onMessage(socket, raw, log, (id) => {
				nodeId = id;
				clearTimeout(helloTimer);
			});
		});

		socket.on("close", () => {
			clearTimeout(helloTimer);
			this.failAllPending(`node disconnected before responding`);
			if (nodeId && this.sockets.get(nodeId) === socket) {
				this.sockets.delete(nodeId);
				void this.markOffline(nodeId, log);
			}
		});
	}

	private async onMessage(
		socket: WebSocket,
		raw: WebSocket.RawData,
		log: { info: (msg: string) => void; warn: (msg: string) => void },
		setNodeId: (id: string) => void,
	): Promise<void> {
		let message: NodeIncomingMessage | NodeResponseMessage | NodeStreamMessage;
		try {
			message = JSON.parse(raw.toString()) as
				| NodeIncomingMessage
				| NodeResponseMessage
				| NodeStreamMessage;
		} catch {
			log.warn("node gateway: malformed message");
			return;
		}

		const currentNodeId = this.nodeIdOf(socket);

		if (!currentNodeId) {
			if (message.kind !== "hello" || typeof message.token !== "string") {
				socket.close(4401, "hello required");
				return;
			}
			const node = await this.authenticate(message.token, message.meta, log);
			if (!node) {
				socket.close(4401, "invalid token");
				return;
			}
			const existing = this.sockets.get(node.id);
			if (existing && existing !== socket) existing.close(4410, "replaced");
			this.sockets.set(node.id, socket);
			setNodeId(node.id);
			socket.send(
				JSON.stringify({
					v: 1,
					kind: "welcome",
					node_id: node.id,
					name: node.name,
				}),
			);
			log.info(`node gateway: ${node.name} (${node.id}) connected`);
			return;
		}

		if (message.kind === "heartbeat") {
			await this.onHeartbeat(currentNodeId, message.details, log);
			return;
		}

		if (message.kind === "response") {
			this.settleRequest(message.id, (pending) => {
				if (message.ok) pending.resolve(message.data);
				else
					pending.reject(
						new Error(
							`node error ${message.error?.code ?? "UNKNOWN"}: ${message.error?.message ?? "unknown error"}`,
						),
					);
			});
			return;
		}

		if (message.kind === "stream") {
			this.pending.get(message.id)?.onStream?.(message.stream, message.chunk);
		}
	}

	private nodeIdOf(socket: WebSocket): string | null {
		for (const [id, candidate] of this.sockets) {
			if (candidate === socket) return id;
		}
		return null;
	}

	private async authenticate(
		token: string,
		meta: NodeMeta | undefined,
		log: { warn: (msg: string) => void },
	): Promise<{ id: string; name: string } | null> {
		try {
			const secret = await this.db
				.selectFrom("node_node_secrets")
				.selectAll()
				.where("secret_hash", "=", hashSecret(token))
				.where("revoked_at", "is", null)
				.executeTakeFirst();
			if (!secret) return null;

			const node = await this.db
				.selectFrom("node_nodes")
				.select(["id", "name"])
				.where("id", "=", secret.node_id)
				.executeTakeFirst();
			if (!node) return null;

			const now = new Date();
			await this.db
				.updateTable("node_node_secrets")
				.set({ last_used_at: now })
				.where("id", "=", secret.id)
				.execute();
			await this.db
				.updateTable("node_nodes")
				.set({
					status: "online",
					hostname: meta?.hostname ?? null,
					platform: meta?.platform ?? null,
					arch: meta?.arch ?? null,
					node_version: meta?.nodeVersion ?? null,
					meta: jsonb(meta ?? {}),
					updated_at: now,
				})
				.where("id", "=", node.id)
				.execute();

			return node;
		} catch (error) {
			log.warn(`node gateway: auth failed: ${String(error)}`);
			return null;
		}
	}

	private async onHeartbeat(
		nodeId: string,
		details: NodeHeartbeatDetails | undefined,
		log: { warn: (msg: string) => void },
	): Promise<void> {
		try {
			await this.db
				.updateTable("node_nodes")
				.set({
					last_heartbeat: jsonb(details ?? null),
					last_seen_at: new Date(),
				})
				.where("id", "=", nodeId)
				.execute();
		} catch (error) {
			log.warn(`node gateway: heartbeat persist failed: ${String(error)}`);
		}
	}

	private async markOffline(
		nodeId: string,
		log: { info: (msg: string) => void; warn: (msg: string) => void },
	): Promise<void> {
		try {
			await this.db
				.updateTable("node_nodes")
				.set({ status: "offline", updated_at: new Date() })
				.where("id", "=", nodeId)
				.execute();
			log.info(`node gateway: ${nodeId} disconnected`);
		} catch (error) {
			log.warn(`node gateway: offline mark failed: ${String(error)}`);
		}
	}
}
