export type SessionNodeDto = {
	id: string;
	name: string;
	status: string;
};

/**
 * A thread message as served by the code plugin. Mirrors the agent plugin's
 * ThreadMessageDto structurally — plugins never import each other's types.
 */
export type SessionMessageDto = {
	id: string;
	thread_id: string;
	seq: number;
	role: string;
	/** verbatim pi AgentMessage payload */
	message: Record<string, unknown>;
	/** true when long text blocks (tool outputs) were trimmed for transport */
	truncated: boolean;
	created_at: string;
};

export type FolderMatchDto = {
	name: string;
	/** absolute path on the node */
	path: string;
	/** path relative to the node's root — usable as a session cwd */
	relative_path: string;
};

export type SessionDto = {
	id: string;
	workspace_id: string;
	/** node agent this session runs on */
	node_id: string;
	/** working directory on the node, relative to its root */
	cwd: string;
	is_git: boolean;
	title: string | null;
	worktree_path: string | null;
	/** agent-plugin thread backing this session */
	thread_id: string | null;
	/** agent config used when the thread is created */
	agent_id: string | null;
	created_by: string;
	/** set when the session is archived; excluded from default listings */
	archived_at: string | null;
	/** true while the session's thread is mid-run (derived, not persisted) */
	running: boolean;
	created_at: string;
	updated_at: string;
};
