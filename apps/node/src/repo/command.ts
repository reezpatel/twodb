import { spawn } from "node:child_process";

export type CommandOptions = {
  cwd: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
};

const createCommand = (command: string, options: CommandOptions) => {
  if (!command || typeof command !== "string") {
    throw new TypeError("A non-empty command is required");
  }

  return spawn(command, options.args ?? [], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: !options.args?.length,
  });
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export const streamCommand = async (
  command: string,
  options: CommandOptions,
): AsyncGenerator<string> => {
  const child = createCommand(command, options);
  const chunks: string[] = [];
  const output: string[] = [];
  let done = false;
  let exitCode = 1;
  let failure: Error | undefined;
  let notify = () => {};
  const wake = () => notify();
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  const onData = (chunk: string) => {
    chunks.push(chunk);
    output.push(chunk);
    wake();
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.once("error", (error) => {
    failure = error;
    done = true;
    wake();
  });
  child.once("close", (code) => {
    exitCode = code ?? 1;
    done = true;
    wake();
  });

  while (!done || chunks.length > 0) {
    if (chunks.length > 0) {
      yield chunks.shift()!;
      continue;
    }
    await new Promise<void>((resolve) => {
      notify = resolve;
    });
  }

  if (failure) throw failure;
  if (exitCode !== 0)
    throw new Error(output.join("") || `Command exited with code ${exitCode}`);
};

export const runCommand = async (
  command: string,
  options: CommandOptions,
): Promise<CommandResult> => {
  const child = createCommand(command, options);
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  return { stdout, stderr, exitCode };
};
