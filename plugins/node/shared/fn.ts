import type { TwodbNodeCommand, TwodbPatchOp } from "@twodb/contracts";
import type {} from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    nodeId?: string;
  }
}

declare module "@twodb/shared-backend" {
  interface TwodbFn {
    "node.runCommand": (input: { nodeId: string; command: string; cwd?: string | null; timeoutMs?: number | null }) => Promise<{ commandId: string }>;
    "node.commandStatus": (commandId: string) => Promise<{ command: TwodbNodeCommand; output: string } | null>;
    "node.patch": (input: { nodeId: string; path: string; baseHash?: string | null; ops: TwodbPatchOp[] }) => Promise<{ patchId: string }>;
  }
}
