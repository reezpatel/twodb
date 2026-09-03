import { spawn } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export type RepoPath = string;
export type DirectoryEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymbolicLink: boolean;
};
export type CommandOptions = {
  args?: string[];
  cwd?: RepoPath;
  env?: NodeJS.ProcessEnv;
};
export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export class Repo {
  constructor(private readonly cwd: string) {}

  resolvePath(filePath: RepoPath): string {
    if (!filePath || typeof filePath !== "string")
      throw new TypeError("A non-empty path is required");
    return path.resolve(this.cwd, filePath);
  }

  async getFile(filePath: RepoPath): Promise<string> {
    return readFile(this.resolvePath(filePath), "utf8");
  }

  async writeFile(filePath: RepoPath, content: string): Promise<void> {
    const target = this.resolvePath(filePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async *streamCommand(
    command: string,
    options: CommandOptions = {},
  ): AsyncGenerator<string> {
    const child = this.createCommand(command, options);
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
      throw new Error(
        output.join("") || `Command exited with code ${exitCode}`,
      );
  }

  async runCommand(
    command: string,
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    const child = this.createCommand(command, options);
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
  }

  async listDir(directoryPath = "."): Promise<DirectoryEntry[]> {
    const directory = this.resolvePath(directoryPath);
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      isSymbolicLink: entry.isSymbolicLink(),
    }));
  }

  async hasFile(filePath: RepoPath): Promise<boolean> {
    try {
      await access(this.resolvePath(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async removeFile(filePath: RepoPath): Promise<void> {
    const target = this.resolvePath(filePath);
    if ((await lstat(target)).isDirectory())
      throw new TypeError("removeFile only accepts files");
    await unlink(target);
  }

  private createCommand(command: string, options: CommandOptions) {
    if (!command || typeof command !== "string")
      throw new TypeError("A non-empty command is required");
    return spawn(command, options.args ?? [], {
      cwd: options.cwd ? this.resolvePath(options.cwd) : this.cwd,
      env: { ...process.env, ...options.env },
      shell: !options.args?.length,
    });
  }
}
