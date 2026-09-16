import type { Selectable } from "kysely";
import type { NodesTable, NodeSecretsTable } from "../db/schema";
import type { NodeDto, NodeSecretDto, NodeStatus } from "../../shared/types";

/**
 * Write helper for jsonb columns: the pg driver serializes JS arrays as
 * Postgres array literals (`{...}`), not JSON — pre-stringify so jsonb
 * params parse correctly.
 */
export function jsonb<T>(value: T): T {
	return JSON.stringify(value) as unknown as T;
}

export function toNodeDto(row: Selectable<NodesTable>): NodeDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		name: row.name,
		status: row.status as NodeStatus,
		hostname: row.hostname,
		platform: row.platform,
		arch: row.arch,
		node_version: row.node_version,
		last_heartbeat: row.last_heartbeat ?? null,
		last_seen_at: row.last_seen_at?.toISOString() ?? null,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toSecretDto(row: Selectable<NodeSecretsTable>): NodeSecretDto {
	return {
		id: row.id,
		node_id: row.node_id,
		label: row.label,
		last_used_at: row.last_used_at?.toISOString() ?? null,
		revoked_at: row.revoked_at?.toISOString() ?? null,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
	};
}
