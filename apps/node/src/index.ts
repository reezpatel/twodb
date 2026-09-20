import os from "node:os";
import { config } from "./config";
import { getStream, post } from "./http";
import { killCommand, runCommand } from "./exec";
import { applyPatch } from "./patch";
import type { TwodbAgentEvent } from "@twodb/contracts";

const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function hello(): Promise<void> {
  await post("/agent/hello", {
    platform: config.platform,
    hostname: os.hostname(),
    arch: process.arch,
    agent_version: config.agentVersion,
    labels: {},
  });
}

function dispatch(event: TwodbAgentEvent): void {
  switch (event.kind) {
    case "command":
      void runCommand(event).catch((error) => console.error("[node] command failed:", error));
      break;
    case "kill":
      killCommand(event.id);
      break;
    case "patch":
      void applyPatch(event).catch((error) => console.error("[node] patch failed:", error));
      break;
    case "ping":
      break;
  }
}

async function consumeQueue(): Promise<void> {
  const body = await getStream("/agent/queue");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("queue stream closed");
    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          dispatch(JSON.parse(line.slice(6)) as TwodbAgentEvent);
        } catch (error) {
          console.error("[node] malformed event:", error);
        }
      }
      separator = buffer.indexOf("\n\n");
    }
  }
}

let running = true;

const shutdown = () => {
  running = false;
  void post("/agent/bye").finally(() => process.exit(0));
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

async function main(): Promise<void> {
  if (!config.token) {
    console.warn("[node] TWODB_NODE_TOKEN is not set — agent idling.");
    console.warn("[node] create a machine in workspace settings, then set the token to enable it.");
    await new Promise(() => {});
    return;
  }
  console.log(`[node] agent v${config.agentVersion} — root ${config.rootDir} (${config.platform})`);

  let attempt = 0;
  while (running) {
    try {
      await hello();
      console.log(`[node] connected to ${config.apiUrl} — waiting for work`);
      await consumeQueue();
      attempt = 0;
    } catch (error) {
      console.error(`[node] ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!running) break;
    const delay = Math.min(1_000 * 2 ** attempt++ + Math.random() * 500, MAX_BACKOFF_MS);
    console.log(`[node] reconnecting in ${Math.round(delay)}ms`);
    await sleep(delay);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
