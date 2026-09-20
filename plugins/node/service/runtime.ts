import type { FastifyReply } from "fastify";
import type { TwodbAgentEvent, TwodbNodeCommandEvent } from "@twodb/contracts";

const OUTPUT_CAP = 256 * 1024;
const RUNTIME_TTL_MS = 10 * 60 * 1000;
const PING_MS = 15_000;

type AgentHandle = {
  nodeId: string;
  send: (event: TwodbAgentEvent) => void;
  close: () => void;
};

type CommandRuntime = {
  events: TwodbNodeCommandEvent[];
  outputChars: number;
  subscribers: Set<(event: TwodbNodeCommandEvent) => void>;
  closedAt: number | null;
};

type PatchRuntime = {
  status: "pending" | "applied" | "failed";
  hash: string | null;
  error: string | null;
  settledAt: number | null;
};

export class NodeRuntime {
  private agents = new Map<string, AgentHandle>();
  private commands = new Map<string, CommandRuntime>();
  private patches = new Map<string, PatchRuntime>();
  private sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  agentOnline(nodeId: string): boolean {
    return this.agents.has(nodeId);
  }

  attachAgent(nodeId: string, reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const previous = this.agents.get(nodeId);
    if (previous) previous.close();

    const handle: AgentHandle = {
      nodeId,
      send: (event) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`),
      close: () => reply.raw.end(),
    };
    this.agents.set(nodeId, handle);
    handle.send({ kind: "ping", at: Date.now() });

    const ping = setInterval(() => handle.send({ kind: "ping", at: Date.now() }), PING_MS);

    reply.raw.on("close", () => {
      clearInterval(ping);
      if (this.agents.get(nodeId) === handle) this.agents.delete(nodeId);
    });
  }

  sendToAgent(nodeId: string, event: TwodbAgentEvent): boolean {
    const agent = this.agents.get(nodeId);
    if (!agent) return false;
    agent.send(event);
    return true;
  }

  private commandRuntime(commandId: string): CommandRuntime {
    let runtime = this.commands.get(commandId);
    if (!runtime) {
      runtime = { events: [], outputChars: 0, subscribers: new Set(), closedAt: null };
      this.commands.set(commandId, runtime);
    }
    return runtime;
  }

  emit(commandId: string, event: TwodbNodeCommandEvent): void {
    const runtime = this.commandRuntime(commandId);
    runtime.events.push(event);
    if (event.type === "chunk") {
      runtime.outputChars += event.data.length;
      while (runtime.outputChars > OUTPUT_CAP) {
        const first = runtime.events[0];
        if (first?.type !== "chunk") break;
        runtime.events.shift();
        runtime.outputChars -= first.data.length;
      }
    }
    if (event.type === "exit" || event.type === "error") {
      runtime.closedAt = runtime.closedAt ?? Date.now();
    }
    for (const subscriber of runtime.subscribers) subscriber(event);
  }

  subscribe(commandId: string, reply: FastifyReply): void {
    const runtime = this.commandRuntime(commandId);

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const write = (event: TwodbNodeCommandEvent) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    for (const event of runtime.events) write(event);

    const keepAlive = setInterval(() => reply.raw.write(": ka\n\n"), PING_MS);
    runtime.subscribers.add(write);
    reply.raw.on("close", () => {
      clearInterval(keepAlive);
      runtime.subscribers.delete(write);
    });
  }

  output(commandId: string): string {
    const runtime = this.commands.get(commandId);
    if (!runtime) return "";
    return runtime.events
      .filter((event): event is Extract<TwodbNodeCommandEvent, { type: "chunk" }> => event.type === "chunk")
      .map((event) => event.data)
      .join("");
  }

  commandFinished(commandId: string): boolean {
    return this.commands.get(commandId)?.closedAt != null;
  }

  setPatch(patchId: string, patch: PatchRuntime): void {
    this.patches.set(patchId, patch);
  }

  patch(patchId: string): PatchRuntime | undefined {
    return this.patches.get(patchId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [commandId, runtime] of this.commands) {
      if (runtime.closedAt != null && now - runtime.closedAt > RUNTIME_TTL_MS) {
        this.commands.delete(commandId);
      }
    }
    for (const [patchId, patch] of this.patches) {
      if (patch.settledAt != null && now - patch.settledAt > RUNTIME_TTL_MS) {
        this.patches.delete(patchId);
      }
    }
  }
}

export const runtime = new NodeRuntime();
