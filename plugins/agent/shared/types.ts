export type AgentDto = {
	id: string;
	workspace_id: string;
	name: string;
	description: string | null;
	provider: string;
	auth_type: string;
	config: Record<string, string>;
	/** keys of secret config fields that are set (values never leave the api) */
	secret_fields: string[];
	has_api_key: boolean;
	model: string | null;
	system_prompt: string | null;
	options: Record<string, unknown>;
	enabled: boolean;
	last_verified_at: string | null;
	usage_last_fetched_at: string | null;
	usage_last_error: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type AgentUsageWindowType =
	| "hourly"
	| "5h"
	| "daily"
	| "weekly"
	| "monthly"
	| "balance";

export type AgentUsageSnapshotDto = {
	id: string;
	window_type: AgentUsageWindowType;
	group_label: string;
	total: number;
	used: number;
	unit: "%" | "Tk" | "$";
	reset_at: string | null;
	captured_at: string;
};

export type AgentUsageDto = {
	snapshots: AgentUsageSnapshotDto[];
	last_fetched_at: string | null;
	last_error: string | null;
};

export type AgentVerifySnapshotDto = {
	window_type: AgentUsageWindowType;
	group_label: string;
	total: number;
	used: number;
	unit: AgentUsageSnapshotDto["unit"];
	reset_at: string | null;
};

export type AgentVerifyResultDto = {
	groups: string[];
	snapshots: AgentVerifySnapshotDto[];
};

// --- threads (pi agent runtime) ---

export type ThreadDto = {
	id: string;
	workspace_id: string;
	agent_id: string;
	thread_intent: string | null;
	is_archived: boolean;
	created_by: string;
	created_at: string;
	updated_at: string;
};

export type ThreadMessageDto = {
	id: string;
	thread_id: string;
	seq: number;
	role: string;
	/** twodb AgentMessage — see the agent contract in @twodb/shared-backend */
	message: Record<string, unknown>;
	/** true when long text blocks (tool outputs) were trimmed for transport */
	truncated: boolean;
	created_at: string;
};
