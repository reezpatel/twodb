import type { NodeInvokeFn } from "@twodb/contracts";
import type { AgentTool } from "@twodb/shared-backend";

const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;
const PATCH_TIMEOUT_MS = 30_000;

/**
 * The code plugin's toolset: every operation executes on the repository's
 * node via the node plugin's root-decorated invoke. `cwd` (the session's
 * worktree_path, falling back to the repository cwd, resolved against the
 * node's root dir) is injected into every payload.
 */
export function buildNodeTools(
	invoke: NodeInvokeFn,
	nodeId: string,
	cwd: string,
): AgentTool[] {
	const call = (
		action: string,
		payload: Record<string, unknown>,
		options?: Parameters<NodeInvokeFn>[3],
	) => invoke(nodeId, action, { ...payload, cwd }, options);

	const readFile: AgentTool = {
		id: "read_file",
		name: "read_file",
		description:
			"Read a file's contents from the repository. Paths are relative to the session cwd.",
		schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "File path, relative to the cwd",
				},
			},
			required: ["path"],
		},
		run: async (input, context) => {
			const params = input.input as { path: string };
			const data = (await call(
				"read_file",
				{ path: params.path },
				{ signal: context?.abort_signal },
			)) as { path: string; content: string };
			return { content: { text: data.content } };
		},
	};

	const writeFile: AgentTool = {
		id: "write_file",
		name: "write_file",
		description:
			"Write a file's contents in the repository (creates or overwrites).",
		schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "File path, relative to the cwd",
				},
				content: {
					type: "string",
					description: "Full file contents to write",
				},
			},
			required: ["path", "content"],
		},
		run: async (input, context) => {
			const params = input.input as { path: string; content: string };
			const data = await call(
				"write_file",
				{ path: params.path, content: params.content },
				{ signal: context?.abort_signal },
			);
			return { content: { text: JSON.stringify(data) } };
		},
	};

	const listDir: AgentTool = {
		id: "list_dir",
		name: "list_dir",
		description: "List directory entries in the repository.",
		schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Directory path; defaults to the cwd",
				},
			},
		},
		run: async (input, context) => {
			const params = input.input as { path?: string };
			const data = (await call(
				"list_dir",
				{ path: params.path ?? "." },
				{ signal: context?.abort_signal },
			)) as { entries: unknown[] };
			return { content: data as unknown as object };
		},
	};

	const findFile: AgentTool = {
		id: "find_file",
		name: "find_file",
		description: "Search for files by name in the repository.",
		schema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Substring to match against file names",
				},
				directory: {
					type: "string",
					description: "Directory to search; defaults to the cwd",
				},
				max_results: {
					type: "number",
					description: "Cap on matches; defaults to 25",
				},
			},
			required: ["query"],
		},
		run: async (input, context) => {
			const params = input.input as {
				query: string;
				directory?: string;
				max_results?: number;
			};
			const data = await call(
				"find_file",
				{
					query: params.query,
					directory: params.directory,
					maxResults: params.max_results,
				},
				{ signal: context?.abort_signal },
			);
			return { content: { text: JSON.stringify(data) } };
		},
	};

	const runCommand: AgentTool = {
		id: "run_command",
		name: "run_command",
		description:
			"Run a shell command in the repository and return its output. Use for builds, tests, git, and inspections.",
		schema: {
			type: "object",
			properties: {
				command: { type: "string", description: "Executable to run" },
				args: {
					type: "array",
					items: { type: "string" },
					description: "Arguments",
				},
				timeout_ms: {
					type: "number",
					description: "Timeout in ms; defaults to 120000",
				},
			},
			required: ["command"],
		},
		run: async (input, context) => {
			const params = input.input as {
				command: string;
				args?: string[];
				timeout_ms?: number;
			};
			const data = (await call(
				"run_command",
				{ command: params.command, args: params.args },
				{
					timeoutMs: params.timeout_ms ?? DEFAULT_COMMAND_TIMEOUT_MS,
					signal: context?.abort_signal,
					onStream: (_stream, chunk) =>
						context?.on_event?.({
							event: "output",
							data: { chunk },
						}),
				},
			)) as {
				stdout: string;
				stderr: string;
				exitCode: number;
				timedOut: boolean;
			};
			return { content: data as unknown as object };
		},
	};

	const editFile: AgentTool = {
		id: "edit_file",
		name: "edit_file",
		description:
			"Replace an exact text block in a file. Fails if the block is missing or matches multiple times — prefer this over write_file for targeted edits.",
		schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "File path, relative to the cwd",
				},
				old_string: {
					type: "string",
					description:
						"Exact text to replace; must match exactly once — include enough context",
				},
				new_string: { type: "string", description: "Replacement text" },
			},
			required: ["path", "old_string", "new_string"],
		},
		run: async (input, context) => {
			const params = input.input as {
				path: string;
				old_string: string;
				new_string: string;
			};
			const data = await call(
				"edit_file",
				{
					path: params.path,
					old_string: params.old_string,
					new_string: params.new_string,
				},
				{ signal: context?.abort_signal },
			);
			return { content: { text: JSON.stringify(data) } };
		},
	};

	const applyPatch: AgentTool = {
		id: "apply_patch",
		name: "apply_patch",
		description:
			"Apply a unified diff across one or more files in the repository (git apply, falls back to patch -p1). Checked before applying — a rejected patch changes nothing.",
		schema: {
			type: "object",
			properties: {
				patch: {
					type: "string",
					description: "Unified diff to apply (git apply format, -p1)",
				},
			},
			required: ["patch"],
		},
		run: async (input, context) => {
			const params = input.input as { patch: string };
			const data = await call(
				"apply_patch",
				{ patch: params.patch },
				{ timeoutMs: PATCH_TIMEOUT_MS, signal: context?.abort_signal },
			);
			return { content: { text: JSON.stringify(data) } };
		},
	};

	return [
		readFile,
		writeFile,
		editFile,
		applyPatch,
		listDir,
		findFile,
		runCommand,
	];
}
