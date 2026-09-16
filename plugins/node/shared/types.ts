export type NodeStatus = "online" | "offline";

export type NodeDto = {
	id: string;
	workspace_id: string;
	name: string;
	status: NodeStatus;
	hostname: string | null;
	platform: string | null;
	arch: string | null;
	node_version: string | null;
	last_heartbeat: NodeHeartbeatDetails | null;
	last_seen_at: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type NodeSecretDto = {
	id: string;
	node_id: string;
	label: string | null;
	last_used_at: string | null;
	revoked_at: string | null;
	created_by: string;
	created_at: string;
};

// --- Node wire protocol (mirror of apps/node/src/types.ts) ---

export type NodeMeta = {
	hostname: string;
	platform: string;
	arch: string;
	nodeVersion: string;
	pid: number;
};

export type NodeHeartbeatDetails = NodeMeta & {
	cpus: number;
	loadavg: number[];
	memoryTotal: number;
	memoryFree: number;
	systemUptimeSec: number;
	processUptimeSec: number;
	activeJobs: number;
	status: "idle" | "busy";
};

export type NodeHelloMessage = {
	v: number;
	kind: "hello";
	token: string;
	meta: NodeMeta;
};

export type NodeHeartbeatMessage = {
	v: number;
	kind: "heartbeat";
	at: number;
	details: NodeHeartbeatDetails;
};

export type NodeIncomingMessage = NodeHelloMessage | NodeHeartbeatMessage;

export type NodeWelcomeMessage = {
	v: number;
	kind: "welcome";
	node_id: string;
	name: string;
};

// --- controller → node request/response protocol ---

export type NodeAction =
	| "read_file"
	| "write_file"
	| "list_dir"
	| "find_file"
	| "run_command"
	| "cancel_command"
	| "mk_dir"
	| "move_path"
	| "delete_path";

export type NodeControllerRequest = {
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

export type NodeResponseMessage =
	| { v: number; kind: "response"; id: string; ok: true; data?: unknown }
	| {
			v: number;
			kind: "response";
			id: string;
			ok: false;
			error: NodeErrorBody;
	  };

export type NodeStreamMessage = {
	v: number;
	kind: "stream";
	id: string;
	stream: "stdout" | "stderr";
	chunk: string;
};
