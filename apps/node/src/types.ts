export const NODE_PROTOCOL_VERSION = 1;

export type NodeAction =
	| "read_file"
	| "write_file"
	| "list_dir"
	| "find_file"
	| "find_dir"
	| "edit_file"
	| "apply_patch"
	| "run_command"
	| "cancel_command"
	| "mk_dir"
	| "move_path"
	| "delete_path";

export type ReadFilePayload = {
	path: string;
	cwd?: string;
};

export type WriteFilePayload = {
	path: string;
	content: string;
	cwd?: string;
};

export type ListDirPayload = {
	path?: string;
	cwd?: string;
};

export type FindFilePayload = {
	query: string;
	directory?: string;
	cwd?: string;
	maxResults?: number;
};

export type RunCommandPayload = {
	command: string;
	args?: string[];
	cwd?: string;
	env?: Record<string, string>;
	timeoutMs?: number;
};

export type CancelCommandPayload = {
	targetId: string;
};

export type ControllerRequest = {
	v: number;
	kind: "request";
	id: string;
	action: NodeAction;
	payload?: unknown;
};

export type NodeErrorBody = {
	code: string;
	message: string;
};

export type NodeMeta = {
	hostname: string;
	platform: string;
	arch: string;
	nodeVersion: string;
	pid: number;
};

export type HeartbeatDetails = NodeMeta & {
	cpus: number;
	loadavg: number[];
	memoryTotal: number;
	memoryFree: number;
	systemUptimeSec: number;
	processUptimeSec: number;
	activeJobs: number;
	status: "idle" | "busy";
};

export type NodeHello = {
	v: number;
	kind: "hello";
	token: string;
	meta: NodeMeta;
};

export type NodeHeartbeat = {
	v: number;
	kind: "heartbeat";
	at: number;
	details: HeartbeatDetails;
};

export type NodeResponse =
	| { v: number; kind: "response"; id: string; ok: true; data?: unknown }
	| {
			v: number;
			kind: "response";
			id: string;
			ok: false;
			error: NodeErrorBody;
	  };

export type NodeStream = {
	v: number;
	kind: "stream";
	id: string;
	stream: "stdout" | "stderr";
	chunk: string;
};

export type NodeMessage = NodeHello | NodeHeartbeat | NodeResponse | NodeStream;

export type ControllerWelcome = {
	v: number;
	kind: "welcome";
	node_id: string;
	name: string;
};

export class NodeError extends Error {
	constructor(
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "NodeError";
	}
}

export const toErrorBody = (error: unknown): NodeErrorBody =>
	error instanceof NodeError
		? { code: error.code, message: error.message }
		: {
				code: "INTERNAL",
				message: error instanceof Error ? error.message : String(error),
			};

export const isWelcome = (message: unknown): message is ControllerWelcome => {
	if (!message || typeof message !== "object") return false;
	const candidate = message as Record<string, unknown>;
	return (
		candidate.kind === "welcome" &&
		typeof candidate.node_id === "string" &&
		typeof candidate.name === "string"
	);
};

export const isControllerRequest = (
	message: unknown,
): message is ControllerRequest => {
	if (!message || typeof message !== "object") return false;
	const candidate = message as Record<string, unknown>;
	return (
		candidate.kind === "request" &&
		typeof candidate.id === "string" &&
		typeof candidate.action === "string"
	);
};
