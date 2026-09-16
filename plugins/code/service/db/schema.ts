import type { Generated } from "kysely";

export interface CodeSessionsTable {
	id: string;
	workspace_id: string;
	/** node agent this session runs on */
	node_id: string;
	/** working directory on the node, relative to its root */
	cwd: string;
	is_git: Generated<boolean>;
	title: string | null;
	/** per-session working directory override (git worktrees) */
	worktree_path: string | null;
	/** agent-plugin thread backing this session */
	thread_id: string | null;
	/** agent config used when the thread is created */
	agent_id: string | null;
	created_by: string;
	archived_at: Generated<Date | null>;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface CodeDB {
	code_sessions: CodeSessionsTable;
}
