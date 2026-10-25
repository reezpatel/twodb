// Full-stack in-process test: boots the real server (port 3101) in this
// process, mints a signed session, connects /api/ws, then fires notify() and
// notifyEphemeral() through the same in-process pipeline the producers use —
// verifying the whole chain end to end: DB rows + room fan-out + frames.

import { WebSocket } from "ws";

process.env.TWODB_PORT = "3101";
process.env.TWODB_LOG_FILE = "/tmp/twodb-e2e.log";

async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeURIComponent(`${value}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`);
}

async function main() {
  // Boot the real server in-process (runs migrations too).
  await import("../src/index");
  await new Promise((r) => setTimeout(r, 2500));

  const { db } = await import("../src/auth");
  const { notify, notifyEphemeral, notifyUpdate } = await import("../src/lib/notifications/notify");

  const member = await db.selectFrom("member").select(["userId", "organizationId"]).limit(1).executeTakeFirst();
  if (!member) throw new Error("no member");
  const { userId, organizationId } = member;

  const sessionId = crypto.randomUUID();
  const token = crypto.randomUUID();
  await db
    .insertInto("session")
    .values({ id: sessionId, userId, token, expiresAt: new Date(Date.now() + 30 * 60_000), ipAddress: "127.0.0.1", userAgent: "e2e", createdAt: new Date(), updatedAt: new Date(), activeOrganizationId: organizationId })
    .execute();
  const secret = process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-in-production";
  const cookie = `better-auth.session_token=${await signCookieValue(token, secret)}`;

  const ws = new WebSocket(`ws://localhost:3101/api/ws`, { headers: { cookie } });
  const frames: { v?: number; event?: string; op?: string; data?: Record<string, unknown> }[] = [];
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.on("message", (d) => frames.push(JSON.parse(String(d))));

  const pongArrived = new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (frames.some((f) => f.op === "pong")) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
  ws.send(JSON.stringify({ v: 1, op: "ping" }));
  await Promise.race([pongArrived, new Promise((r) => setTimeout(r, 5000))]);
  console.log("gateway live:", frames.some((f) => f.op === "pong"));

  // REST: feed + counts through the real HTTP surface with the minted cookie.
  const feed0 = await fetch("http://localhost:3101/api/notifications?state=active", { headers: { cookie } }).then((r) => r.json());
  console.log("REST feed items:", feed0.items?.length, "counts:", JSON.stringify(feed0.counts));

  const n = await notify({
    organizationId,
    type: "core.system",
    audience: { kind: "user", userId },
    title: "E2E in-process: hello",
    body: "through the real pipeline",
    urgency: "high",
  });
  await notifyUpdate(n.id, { body: "updated in place" });
  await notifyEphemeral({ organizationId, type: "core.runner", audience: { kind: "user", userId }, title: "E2E in-process: ephemeral", ttlMs: 2000 });
  await new Promise((r) => setTimeout(r, 800));

  const events = frames.map((f) => f.event ?? f.op).filter(Boolean);
  console.log("frames:", events.join(", "));
  const gotNew = frames.some((f) => f.event === "notification.new" && f.data?.id === n.id);
  const gotUpdated = frames.some((f) => f.event === "notification.updated" && f.data?.id === n.id && f.data?.revision === 2);
  const gotEphemeral = frames.some((f) => f.event === "notification.ephemeral" && f.data?.title === "E2E in-process: ephemeral");

  // REST: read + dismiss + unarchive + counts, and watch state frames.
  const read = await fetch(`http://localhost:3101/api/notifications/${n.id}/read`, { method: "POST", headers: { cookie } }).then((r) => r.json());
  const dismiss = await fetch(`http://localhost:3101/api/notifications/${n.id}/dismiss`, { method: "POST", headers: { cookie } }).then((r) => r.json());
  const unarchive = await fetch(`http://localhost:3101/api/notifications/${n.id}/unarchive`, { method: "POST", headers: { cookie } }).then((r) => r.json());
  await new Promise((r) => setTimeout(r, 400));
  const stateFrames = frames.filter((f) => f.event === "notification.state");
  console.log("REST read/dismiss/unarchive:", read.read === true, dismiss.archived === true, unarchive.archived === false);

  // Feed reflects archive filter.
  const feedArchived = await fetch("http://localhost:3101/api/notifications?state=archived", { headers: { cookie } }).then((r) => r.json());

  // cleanup
  ws.close();
  await db.deleteFrom("session").where("id", "=", sessionId).execute();
  await db.deleteFrom("notification").where("id", "=", n.id).execute();

  console.log("checks — new:", gotNew, "updated(rev2):", gotUpdated, "ephemeral:", gotEphemeral, "state-frames:", stateFrames.length >= 2, "archive-feed:", feedArchived.items?.some((i: { id: string }) => i.id === n.id) === false);
  const pass = gotNew && gotUpdated && gotEphemeral && stateFrames.length >= 2;
  console.log(pass ? "FULL E2E PASSED" : "FULL E2E FAILED");
  await db.destroy();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});
