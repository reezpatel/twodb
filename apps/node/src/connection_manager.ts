import WebSocket from "ws";
import {
	NODE_PROTOCOL_VERSION,
	isControllerRequest,
	isWelcome,
	type NodeMessage,
} from "./types";
import { heartbeatDetails, nodeMeta } from "./utils";
import { handleRequest } from "./handlers";
import { ProcessRegistry } from "./repo/command";

export enum ConnectionStatus {
	CONNECTED = "connected",
	CONNECTING = "connecting",
	FAILED = "failed",
	NOT_STARTED = "not_started",
}

export type ConnectionOptions = {
	url: string;
	token: string;
	rootDir: string;
	heartbeatMs: number;
};

const MAX_RECONNECT_DELAY_MS = 30_000;

export class ConnectionManager {
	status: ConnectionStatus = ConnectionStatus.NOT_STARTED;

	private ws: WebSocket | null = null;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private attempts = 0;
	private stopping = false;
	private resolveDone: (() => void) | null = null;
	private readonly processes = new ProcessRegistry();

	constructor(private readonly options: ConnectionOptions) {}

	begin(): Promise<void> {
		if (!this.options.token) {
			throw new Error("token is required for connection manager");
		}
		return new Promise((resolve) => {
			this.resolveDone = resolve;
			this.connect();
		});
	}

	async stop(): Promise<void> {
		this.stopping = true;
		this.clearReconnect();
		this.stopHeartbeat();
		this.processes.killAll();
		if (this.ws) {
			this.ws.removeAllListeners();
			try {
				this.ws.close();
			} catch (error) {
				console.error("[node] error while closing socket:", error);
			}
			this.ws = null;
		}
		this.resolveDone?.();
	}

	private connect(): void {
		if (this.stopping) return;
		this.status = ConnectionStatus.CONNECTING;
		console.log(`[node] connecting to ${this.options.url} ...`);

		const ws = new WebSocket(this.options.url, {
			headers: { authorization: `Bearer ${this.options.token}` },
		});
		this.ws = ws;

		ws.on("open", () => {
			this.status = ConnectionStatus.CONNECTED;
			this.attempts = 0;
			console.log("[node] connected");
			this.sendHello();
			this.startHeartbeat();
		});

		ws.on("message", (data) => this.onMessage(data));

		ws.on("close", (code, reason) => {
			console.log(
				`[node] disconnected (${code}${reason.length ? `: ${reason}` : ""})`,
			);
			this.onDisconnect();
		});

		ws.on("error", (error) => {
			this.status = ConnectionStatus.FAILED;
			console.error(`[node] socket error: ${error.message}`);
			ws.close();
		});
	}

	private onDisconnect(): void {
		this.stopHeartbeat();
		this.processes.killAll();
		this.ws = null;
		if (this.stopping) {
			this.resolveDone?.();
			return;
		}
		const delay = Math.min(
			1_000 * 2 ** this.attempts++ + Math.random() * 500,
			MAX_RECONNECT_DELAY_MS,
		);
		console.log(`[node] reconnecting in ${Math.round(delay)}ms`);
		this.reconnectTimer = setTimeout(() => this.connect(), delay);
	}

	private clearReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private send(message: NodeMessage): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	private sendHello(): void {
		this.send({
			v: NODE_PROTOCOL_VERSION,
			kind: "hello",
			token: this.options.token,
			meta: nodeMeta(),
		});
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			this.send({
				v: NODE_PROTOCOL_VERSION,
				kind: "heartbeat",
				at: Date.now(),
				details: heartbeatDetails(this.processes.size),
			});
		}, this.options.heartbeatMs);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private onMessage(data: WebSocket.RawData): void {
		let message: unknown;
		try {
			message = JSON.parse(data.toString());
		} catch {
			console.error("[node] received malformed message");
			return;
		}
		if (isWelcome(message)) {
			console.log(
				`[node] registered as "${message.name}" (${message.node_id})`,
			);
			return;
		}
		if (!isControllerRequest(message)) {
			console.error("[node] received unknown message shape");
			return;
		}
		handleRequest(message, {
			rootDir: this.options.rootDir,
			send: (response) => this.send(response),
			processes: this.processes,
		}).catch((error) => {
			console.error("[node] handler crashed:", error);
		});
	}
}
