// @twodb/core-async/relay — durable app-to-app messaging on top of each app's own queue.
//
//   sender:   relay.send(...)  → enqueue into the SENDER's queue (atomic with its own writes, survives
//                                the receiver being down) → relay worker delivers with retries.
//   receiver: relay.receive(...) → verify (transport's job), dedupe, enqueue into the RECEIVER's own queue,
//                                 ack immediately; the receiver's normal workers process it at their pace.
//
// The engine is per-app-schema, so apps never touch each other's tables. This module is transport-agnostic:
// the HTTP + service-token plumbing is injected (see @twodb/twodb-core `createServiceRelay`).

import type { AsyncEngine, DeadJobHandler, EnqueueOptions } from "../engine/index.js";
import { PermanentJobError } from "../engine/index.js";

export const RELAY_OUT_JOB = "relay.out";

export interface OutboundMessage {
  /** Receiving app slug. */
  app: string;
  /** Message/job type the receiver declared (also the scope of the service token). */
  type: string;
  workspaceId: string;
  payload: unknown;
  /** Receiver-side idempotency key. Required: delivery is at-least-once. */
  dedupeKey: string;
  /** Attribution only (never authorization), e.g. the bot or user the message is on behalf of. */
  act?: { type: string; id: string };
}

export interface RelayOptions {
  engine: AsyncEngine;
  /** Performs one delivery attempt. Throw to retry; throw `PermanentJobError` to give up. */
  deliver(msg: OutboundMessage): Promise<void>;
  /** Parallel deliveries (default 4). */
  concurrency?: number;
  /** Delivery attempts before a message is dead-lettered (default 12 ≈ 8 minutes of backoff). */
  maxAttempts?: number;
  onDead?: DeadJobHandler;
}

export function createRelay(options: RelayOptions) {
  const { engine } = options;
  const maxAttempts = options.maxAttempts ?? 12;
  let worker: { stop(): Promise<void> } | null = null;

  return {
    /** Queue a message for another app. Returns once it is durably stored locally. */
    async send(msg: OutboundMessage, opts: { runAt?: Date } = {}): Promise<string> {
      return engine.queue.enqueue(RELAY_OUT_JOB, msg, {
        dedupeKey: `${msg.app}:${msg.type}:${msg.dedupeKey}`,
        maxAttempts,
        leaseMs: 30_000,
        runAt: opts.runAt,
      });
    },

    /** Start the delivery worker. Call once at boot. */
    start() {
      if (worker) return;
      if (options.onDead) engine.queue.onDead([RELAY_OUT_JOB], options.onDead);
      worker = engine.queue.worker(
        [RELAY_OUT_JOB],
        async (job) => {
          await options.deliver(job.payload as OutboundMessage);
        },
        { concurrency: options.concurrency ?? 4, pollIntervalMs: 500 },
      );
    },

    async stop() {
      await worker?.stop();
      worker = null;
    },

    /**
     * Accept a verified inbound message: enqueue it into this app's own queue under `type`, keyed for
     * idempotency. `workspaceId` must come from the verified service token, never the request body —
     * it is written into the job payload as `workspaceId`, overriding anything the sender put there.
     */
    async receive(input: { type: string; workspaceId: string; payload: unknown; dedupeKey: string; opts?: Pick<EnqueueOptions, "maxAttempts" | "leaseMs"> }): Promise<{ id: string }> {
      const body = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? (input.payload as Record<string, unknown>) : { value: input.payload };
      const id = await engine.queue.enqueue(input.type, { ...body, workspaceId: input.workspaceId }, { dedupeKey: input.dedupeKey, ...input.opts });
      return { id };
    },
  };
}

export type Relay = ReturnType<typeof createRelay>;
export { PermanentJobError };
