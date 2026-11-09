# @twodb/core-async

Generic Postgres-backed **queue** + **broadcast**, per-app-schema. The
engine (`./engine`) is intentionally untyped (`payload: unknown`) so any
app — including future third-party/AI-authored ones — can use it without
this package knowing their shapes. Type safety and documentation come from
the optional layer on top (`./registry`).

## Engine
```ts
import { createAsyncEngine } from "@twodb/core-async/engine";

const async = createAsyncEngine({ connectionString, schema: "twomail" });
await async.init(); // idempotent, creates _queue_jobs table in this app's schema

await async.queue.enqueue("send-email", { threadId: "..." });
async.queue.worker(["send-email"], async (job) => { /* ... */ });

await async.broadcast.publish("mail.received", { threadId: "..." });
await async.broadcast.subscribe((msg) => { /* msg.event, msg.payload */ });
```

## Registry (typed, generates MESSAGES.md)
```ts
import { z } from "zod";
import { defineJob, defineBroadcastEvent, defineAppMessages, writeMessagesArtifacts } from "@twodb/core-async/registry";

export const sendEmailJob = defineJob({
  type: "send-email",
  description: "Sends a composed draft via the configured outbound provider.",
  direction: "consumes",
  payload: z.object({ threadId: z.string() }),
});

export const mailReceivedEvent = defineBroadcastEvent({
  event: "mail.received",
  description: "A new message landed in a mailbox.",
  direction: "produces",
  relatedApps: ["twoloop"],
  payload: z.object({ threadId: z.string(), workspaceId: z.string() }),
});

const messages = defineAppMessages({
  name: "TwoMail", slug: "twomail",
  jobs: [sendEmailJob], events: [mailReceivedEvent],
});

// in scripts/gen-docs.ts:
await writeMessagesArtifacts(messages, ".");
```

Broadcast payloads should stay small — an id/envelope, not the full record
(NOTIFY has an ~8KB limit) — consumers fetch full data from the owning
app's API (via the Gateway) if they need it.
