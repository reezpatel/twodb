import { spawn, type ChildProcess } from "node:child_process";
import { NodeError } from "../types";

export type CommandOptions = {
	cwd: string;
	args?: string[];
	env?: NodeJS.ProcessEnv;
	timeoutMs?: number;
	input?: string;
};

export type CommandResult = {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
};

export class ProcessRegistry {
	private readonly processes = new Map<string, ChildProcess>();

	add(id: string, child: ChildProcess): void {
		this.processes.set(id, child);
	}

	remove(id: string): void {
		this.processes.delete(id);
	}

	kill(id: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
		const child = this.processes.get(id);
		if (!child) return false;
		child.kill(signal);
		return true;
	}

	killAll(signal: NodeJS.Signals = "SIGTERM"): void {
		for (const child of this.processes.values()) child.kill(signal);
		this.processes.clear();
	}

	get size(): number {
		return this.processes.size;
	}
}

const createCommand = (command: string, options: CommandOptions) => {
	if (!command || typeof command !== "string") {
		throw new NodeError("BAD_PAYLOAD", "a non-empty command is required");
	}
	return spawn(command, options.args ?? [], {
		cwd: options.cwd,
		env: { ...process.env, ...options.env },
		shell: !options.args?.length,
	});
};

type Collected = {
	stdout: string;
	stderr: string;
};

const settle = (
	child: ChildProcess,
	collected: Collected,
	options: CommandOptions,
): Promise<CommandResult> =>
	new Promise((resolve, reject) => {
		let timedOut = false;
		const timer =
			options.timeoutMs && options.timeoutMs > 0
				? setTimeout(() => {
						timedOut = true;
						child.kill("SIGTERM");
					}, options.timeoutMs)
				: undefined;

		child.once("error", (error) => {
			if (timer) clearTimeout(timer);
			reject(error);
		});
		child.once("close", (code) => {
			if (timer) clearTimeout(timer);
			resolve({
				stdout: collected.stdout,
				stderr: collected.stderr,
				exitCode: code ?? 1,
				timedOut,
			});
		});
	});

export const runCommand = async (
	command: string,
	options: CommandOptions,
): Promise<CommandResult> => {
	const child = createCommand(command, options);
	const collected: Collected = { stdout: "", stderr: "" };
	child.stdout!.setEncoding("utf8");
	child.stderr!.setEncoding("utf8");
	child.stdout!.on("data", (chunk: string) => {
		collected.stdout += chunk;
	});
	child.stderr!.on("data", (chunk: string) => {
		collected.stderr += chunk;
	});
	if (options.input !== undefined && child.stdin) {
		child.stdin.write(options.input);
		child.stdin.end();
	}
	return settle(child, collected, options);
};

export type StreamSink = (stream: "stdout" | "stderr", chunk: string) => void;

export type StreamingHooks = {
	register?: (child: ChildProcess) => void;
	unregister?: () => void;
};

export const runCommandStreaming = async (
	command: string,
	options: CommandOptions,
	onOutput: StreamSink,
	hooks: StreamingHooks = {},
): Promise<CommandResult> => {
	const child = createCommand(command, options);
	const collected: Collected = { stdout: "", stderr: "" };
	child.stdout!.setEncoding("utf8");
	child.stderr!.setEncoding("utf8");
	child.stdout!.on("data", (chunk: string) => {
		collected.stdout += chunk;
		onOutput("stdout", chunk);
	});
	child.stderr!.on("data", (chunk: string) => {
		collected.stderr += chunk;
		onOutput("stderr", chunk);
	});
	hooks.register?.(child);
	try {
		return await settle(child, collected, options);
	} finally {
		hooks.unregister?.();
	}
};
