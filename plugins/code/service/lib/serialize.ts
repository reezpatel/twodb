import type { Selectable } from "kysely";
import type { CodeSessionsTable } from "../db/schema";
import type { SessionDto } from "../../shared/types";

export function toSessionDto(
	row: Selectable<CodeSessionsTable>,
	running = false,
): SessionDto {
	return {
		id: row.id,
		workspace_id: row.workspace_id,
		node_id: row.node_id,
		cwd: row.cwd,
		is_git: row.is_git,
		title: row.title,
		worktree_path: row.worktree_path,
		thread_id: row.thread_id,
		agent_id: row.agent_id,
		created_by: row.created_by,
		archived_at: row.archived_at ? row.archived_at.toISOString() : null,
		running,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
	};
}
