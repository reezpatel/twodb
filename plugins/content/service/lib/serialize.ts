import type { ContentNodeDto, ContentViewDto } from "@twodb/contracts";

/**
 * Write helper for jsonb columns: the pg driver serializes JS arrays as
 * Postgres array literals (`{...}`), not JSON — pre-stringify so jsonb
 * params parse correctly.
 */
export function jsonb<T>(value: T): T {
	return JSON.stringify(value) as unknown as T;
}

import type { Selectable } from "kysely";
import type { ContentNodesTable, ContentViewsTable } from "../db/schema";

export function toNodeDto(row: Selectable<ContentNodesTable>): ContentNodeDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		parent_id: row.parent_id,
		type: row.type,
		name: row.name,
		identifier: row.identifier,
		position: row.position,
		deleted: row.deleted,
		show_in_overview: row.show_in_overview,
		columns_config: row.columns_config,
		default_view: row.default_view,
		created_by: row.created_by,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}

export function toViewDto(row: Selectable<ContentViewsTable>): ContentViewDto {
	return {
		id: row.id,
		section_id: row.section_id,
		workspace_id: row.workspace_id,
		name: row.name,
		type: row.type,
		config: row.config,
		is_default: row.is_default,
		position: row.position,
		deleted: row.deleted,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}
