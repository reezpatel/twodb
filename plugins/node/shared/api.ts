import type { TwodbAgentEvent, TwodbNodeCommand, TwodbNodeCommandEvent, TwodbNodeInfo, TwodbNodePatch, TwodbPatchOp } from "@twodb/contracts";

export type { TwodbAgentEvent, TwodbNodeCommand, TwodbNodeCommandEvent, TwodbNodeInfo, TwodbNodePatch, TwodbPatchOp };

export type CreateNodeRequest = {
  name: string;
  labels?: Record<string, string>;
};

export type UpdateNodeRequest = {
  name?: string;
  labels?: Record<string, string>;
};

export type CreatedNode = {
  node: TwodbNodeInfo;
  token: string;
};

export type RunCommandRequest = {
  command: string;
  cwd?: string | null;
  timeout_ms?: number | null;
};

export type PatchRequest = {
  path: string;
  base_hash?: string | null;
  ops: TwodbPatchOp[];
};
