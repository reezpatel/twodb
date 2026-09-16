import type { Generated } from "kysely";
import type { NodeStatus, NodeHeartbeatDetails } from "../../shared/types";

export interface NodesTable {
	id: string;
	workspace_id: string;
	name: string;
	status: Generated<NodeStatus>;
	hostname: string | null;
	platform: string | null;
	arch: string | null;
	node_version: string | null;
	meta: Generated<Record<string, unknown>>;
	last_heartbeat: NodeHeartbeatDetails | null;
	last_seen_at: Date | null;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface NodeSecretsTable {
	id: string;
	node_id: string;
	workspace_id: string;
	secret_hash: string;
	label: string | null;
	last_used_at: Date | null;
	revoked_at: Date | null;
	created_by: string;
	created_at: Generated<Date>;
}

export interface NodeDB {
	node_nodes: NodesTable;
	node_node_secrets: NodeSecretsTable;
}
