export type TwodbNodePlatform = "windows" | "macos" | "linux" | "docker" | "unknown";

export type TwodbNodeStatus = "online" | "offline" | "unknown";

export type TwodbNodeInfo = {
  id: string;
  name: string;
  platform: TwodbNodePlatform;
  hostname: string;
  arch: string;
  agent_version: string;
  labels: Record<string, string>;
  status: TwodbNodeStatus;
  last_seen_at: string | null;
  created_at: string;
};

export type TwodbNodeCommandStatus = "queued" | "running" | "done" | "error" | "timeout" | "cancelled";

export type TwodbNodeCommand = {
  id: string;
  node_id: string;
  command: string;
  cwd: string | null;
  status: TwodbNodeCommandStatus;
  exit_code: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type TwodbNodeCommandEvent =
  | { type: "start"; at: string }
  | { type: "chunk"; stream: "stdout" | "stderr"; data: string; at: string }
  | { type: "exit"; code: number | null; signal?: string; at: string }
  | { type: "error"; error: string; at: string };

export type TwodbPatchOp = {
  start: number;
  delete_count: number;
  lines: string[];
};

export type TwodbAgentEvent =
  | { kind: "command"; id: string; command: string; cwd: string | null; timeout_ms: number | null }
  | { kind: "kill"; id: string }
  | { kind: "patch"; id: string; path: string; base_hash: string | null; ops: TwodbPatchOp[] }
  | { kind: "ping"; at: number };

export type TwodbAgentHello = {
  platform: TwodbNodePlatform;
  hostname: string;
  arch: string;
  agent_version: string;
  labels: Record<string, string>;
};

export type TwodbNodePatchStatus = "pending" | "applied" | "failed";

export type TwodbNodePatch = {
  id: string;
  node_id: string;
  path: string;
  status: TwodbNodePatchStatus;
  hash: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};
