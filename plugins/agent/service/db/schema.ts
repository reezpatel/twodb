import type { Generated } from "kysely";

export interface AgentAgentsTable {
	id: string;
	workspace_id: string;
	name: string;
	description: string | null;
	provider: string;
	auth_type: Generated<string>;
	secret_encrypted: string | null;
	config: Generated<Record<string, string>>;
	model: string | null;
	system_prompt: string | null;
	options: Generated<Record<string, unknown>>;
	enabled: Generated<boolean>;
	last_verified_at: Date | null;
	usage_last_fetched_at: Date | null;
	usage_last_error: string | null;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface AgentUsageSnapshotsTable {
	id: string;
	agent_id: string;
	workspace_id: string;
	captured_at: Generated<Date>;
	window_type: string;
	group_label: Generated<string>;
	total: number;
	used: number;
	unit: string;
	reset_at: Date | null;
}

export interface AgentThreadsTable {
	id: string;
	workspace_id: string;
	agent_id: string;
	thread_intent: string | null;
	is_archived: Generated<boolean>;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface AgentMessagesTable {
	id: string;
	thread_id: string;
	workspace_id: string;
	seq: number;
	role: string;
	/** full pi AgentMessage jsonb — the replay source of truth */
	message: Generated<Record<string, unknown>>;
	created_at: Generated<Date>;
}

export interface AgentDB {
	agent_agents: AgentAgentsTable;
	agent_usage_snapshots: AgentUsageSnapshotsTable;
	agent_threads: AgentThreadsTable;
	agent_messages: AgentMessagesTable;
}
