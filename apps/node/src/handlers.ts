import type { ChildProcess } from "node:child_process";
import {
	NODE_PROTOCOL_VERSION,
	NodeError,
	toErrorBody,
	type ControllerRequest,
	type NodeMessage,
} from "./types";
import {
	getFile,
	listDir,
	writeFile,
	findFile,
	findDir,
	editFile,
	mkDir,
	movePath,
	deletePath,
} from "./repo/file";
import { applyPatch } from "./repo/patch";
import { runCommandStreaming, type ProcessRegistry } from "./repo/command";
import path from "node:path";
import { resolvePath } from "./utils";

export type HandlerContext = {
	rootDir: string;
	send: (message: NodeMessage) => void;
	processes: ProcessRegistry;
};

const requireString = (value: unknown, field: string): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new NodeError("BAD_PAYLOAD", `missing or invalid "${field}"`);
	}
	return value;
};

const optionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const baseDir = (
	context: HandlerContext,
	payload: Record<string, unknown>,
): string => {
	const cwd = optionalString(payload.cwd);
	return cwd ? resolvePath(context.rootDir, cwd) : context.rootDir;
};

export const handleRequest = async (
	request: ControllerRequest,
	context: HandlerContext,
): Promise<void> => {
	try {
		const data = await execute(request, context);
		context.send({
			v: NODE_PROTOCOL_VERSION,
			kind: "response",
			id: request.id,
			ok: true,
			data,
		});
	} catch (error) {
		context.send({
			v: NODE_PROTOCOL_VERSION,
			kind: "response",
			id: request.id,
			ok: false,
			error: toErrorBody(error),
		});
	}
};

const execute = async (
	request: ControllerRequest,
	context: HandlerContext,
): Promise<unknown> => {
	const payload = (request.payload ?? {}) as Record<string, unknown>;

	switch (request.action) {
		case "read_file": {
			const filePath = requireString(payload.path, "path");
			const encoding =
				payload.encoding === "base64" ? ("base64" as const) : undefined;
			return {
				path: filePath,
				encoding,
				content: await getFile(baseDir(context, payload), filePath, encoding),
			};
		}
		case "write_file": {
			const filePath = requireString(payload.path, "path");
			if (typeof payload.content !== "string") {
				throw new NodeError("BAD_PAYLOAD", 'missing or invalid "content"');
			}
			const encoding =
				payload.encoding === "base64" ? ("base64" as const) : undefined;
			const bytes = Buffer.byteLength(payload.content, encoding);
			await writeFile(
				baseDir(context, payload),
				filePath,
				payload.content,
				encoding,
			);
			return { path: filePath, bytes };
		}
		case "list_dir": {
			const directory = optionalString(payload.path) ?? ".";
			return { entries: await listDir(baseDir(context, payload), directory) };
		}
		case "find_file": {
			const matches = await findFile(baseDir(context, payload), {
				query: requireString(payload.query, "query"),
				directory: optionalString(payload.directory),
				maxResults: optionalNumber(payload.maxResults),
			});
			return { matches };
		}
		case "find_dir": {
			const matches = await findDir(baseDir(context, payload), {
				query: requireString(payload.query, "query"),
				directory: optionalString(payload.directory),
				maxResults: optionalNumber(payload.maxResults),
			});
			return { matches };
		}
		case "edit_file": {
			const filePath = requireString(payload.path, "path");
			const oldString = requireString(payload.old_string, "old_string");
			if (typeof payload.new_string !== "string") {
				throw new NodeError("BAD_PAYLOAD", 'missing or invalid "new_string"');
			}
			return editFile(
				baseDir(context, payload),
				filePath,
				oldString,
				payload.new_string,
			);
		}
		case "apply_patch": {
			const diff = requireString(payload.patch, "patch");
			return applyPatch(baseDir(context, payload), diff);
		}
		case "mk_dir": {
			const dirPath = requireString(payload.path, "path");
			await mkDir(baseDir(context, payload), dirPath);
			return { path: dirPath, created: true };
		}
		case "move_path": {
			const from = requireString(payload.from, "from");
			const to = requireString(payload.to, "to");
			await movePath(baseDir(context, payload), from, to);
			return { from, to, moved: true };
		}
		case "delete_path": {
			const targetPath = requireString(payload.path, "path");
			if (
				resolvePath(baseDir(context, payload), targetPath) ===
				path.resolve(baseDir(context, payload))
			) {
				throw new NodeError("BAD_PAYLOAD", "refusing to delete the root");
			}
			await deletePath(
				baseDir(context, payload),
				targetPath,
				payload.recursive === true,
			);
			return { path: targetPath, deleted: true };
		}
		case "run_command":
			return runCommandAction(request.id, payload, context);
		case "cancel_command": {
			const targetId = requireString(payload.targetId, "targetId");
			if (!context.processes.kill(targetId)) {
				throw new NodeError(
					"NOT_FOUND",
					`no running command with id "${targetId}"`,
				);
			}
			return { targetId, killed: true };
		}
		default:
			throw new NodeError(
				"UNKNOWN_ACTION",
				`unsupported action "${request.action}"`,
			);
	}
};

const runCommandAction = async (
	id: string,
	payload: Record<string, unknown>,
	context: HandlerContext,
): Promise<unknown> => {
	const command = requireString(payload.command, "command");
	const args = Array.isArray(payload.args)
		? payload.args.filter((arg): arg is string => typeof arg === "string")
		: undefined;
	const cwd = baseDir(context, payload);
	const env =
		payload.env && typeof payload.env === "object"
			? Object.fromEntries(
					Object.entries(payload.env as Record<string, unknown>).filter(
						(entry): entry is [string, string] => typeof entry[1] === "string",
					),
				)
			: undefined;

	return runCommandStreaming(
		command,
		{
			cwd,
			args,
			env,
			timeoutMs: optionalNumber(payload.timeoutMs),
		},
		(stream, chunk) =>
			context.send({
				v: NODE_PROTOCOL_VERSION,
				kind: "stream",
				id,
				stream,
				chunk,
			}),
		{
			register: (child: ChildProcess) => context.processes.add(id, child),
			unregister: () => context.processes.remove(id),
		},
	);
};
