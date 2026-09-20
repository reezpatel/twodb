import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
import path from "node:path";
import { post } from "./http";
import { config } from "./config";
import type { TwodbAgentEvent } from "@twodb/contracts";

const FLUSH_MS = 40;

type Running = { child: ChildProcess; killReason: null | "timeout" | "cancelled" };

const running = new Map<string, Running>();

type CommandEvent = Extract<TwodbAgentEvent, { kind: "command" }>;

const resolveCwd = (cwd: string | null): string => path.resolve(config.rootDir, cwd ?? ".");

export function killCommand(id: string): boolean {
  const entry = running.get(id);
  if (!entry) return false;
  entry.killReason = "cancelled";
  entry.child.kill("SIGTERM");
  return true;
}

export async function runCommand(event: CommandEvent): Promise<void> {
  await post(`/agent/commands/${event.id}/start`);

  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "cmd" : "/bin/sh", [...(isWin ? ["/c"] : ["-c"]), event.command], {
    cwd: resolveCwd(event.cwd),
    env: process.env,
  });
  const entry: Running = { child, killReason: null };
  running.set(event.id, entry);

  const pipe = (stream: Readable | null, name: "stdout" | "stderr") => {
    if (!stream) return;
    stream.setEncoding("utf8");
    let pending = "";
    let timer: NodeJS.Timeout | null = null;
    const flush = () => {
      timer = null;
      if (pending.length === 0) return;
      const data = pending;
      pending = "";
      void post(`/agent/commands/${event.id}/chunk`, { stream: name, data }).catch(() => {});
    };
    stream.on("data", (chunk: string) => {
      pending += chunk;
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    });
    stream.on("end", flush);
  };
  pipe(child.stdout, "stdout");
  pipe(child.stderr, "stderr");

  const timeout =
    event.timeout_ms != null
      ? setTimeout(() => {
          entry.killReason = "timeout";
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
        }, event.timeout_ms)
      : null;

  const settle = async (status: string, code: number | null, signal?: string) => {
    if (timeout) clearTimeout(timeout);
    running.delete(event.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await post(`/agent/commands/${event.id}/exit`, { status, code, signal });
  };

  child.on("error", async (error) => {
    console.log(`[node] exec error: ${error.message}`);
    if (timeout) clearTimeout(timeout);
    running.delete(event.id);
    await post(`/agent/commands/${event.id}/exit`, {
      status: "error",
      code: null,
      error: error.message,
    });
  });

  child.on("close", (code, signal) => {
    console.log(`[node] exec close: id=${event.id} code=${code} signal=${signal} reason=${entry.killReason}`);
    const status = entry.killReason === "timeout" ? "timeout" : entry.killReason === "cancelled" ? "cancelled" : "done";
    void settle(status, code, signal ?? undefined);
  });
}
