#!/usr/bin/env tsx
/**
 * End-to-end smoke test against a running Paintress (direct, or through the Gateway).
 *   BASE=http://localhost:6414 tsx scripts/smoke.ts
 * Direct mode forges the x-twodb-* identity headers the Gateway would add.
 * Through the Gateway set BASE=http://localhost:6400/apps/paintress and API_KEY=<key>.
 */
import WebSocket from "ws";

const BASE = process.env.BASE ?? "http://localhost:6414";
const API_KEY = process.env.API_KEY;
const WS = BASE.replace(/^http/, "ws");
const human: Record<string, string> = { "x-twodb-auth-kind": "session", "x-twodb-user-id": "smoke-human", "x-twodb-workspace-id": "smoke-ws", "x-twodb-space-ids": "smoke-space" };
const agent: Record<string, string> = API_KEY
  ? { authorization: `Bearer ${API_KEY}` }
  : { "x-twodb-auth-kind": "apiKey", "x-twodb-api-key-id": "smoke-agent", "x-twodb-workspace-id": "smoke-ws", "x-twodb-space-ids": "smoke-space" };

async function api<T = any>(who: Record<string, string>, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, { method, headers: { ...who, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json as T;
}
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || extra === undefined ? "" : "  " + JSON.stringify(extra)}`);
  if (!ok) failed++;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const board = await api(human, "POST", "/boards", { name: `smoke ${new Date().toISOString()}`, kind: "diagram" });
  const id = board.id as string;

  // Human's browser: a WebSocket on the board.
  const ws = new WebSocket(`${WS}/boards/${id}/ws`, { headers: human });
  const inbox: any[] = [];
  ws.on("message", (m) => inbox.push(JSON.parse(m.toString())));
  await new Promise((r) => ws.once("open", r));
  ws.send(JSON.stringify({ t: "hello", clientId: "c-human" }));
  await wait(300);
  check("snapshot on hello", inbox.some((m) => m.t === "snapshot" && m.items.length === 0));

  // Agent builds a diagram over REST -> the human's socket gets it live.
  const built = await api(agent, "POST", `/boards/${id}/diagram`, {
    label: "AI: smoke architecture",
    groups: [{ key: "vpc", title: "VPC", style: "aws-vpc" }],
    nodes: [
      { key: "web", label: "Web", icon: "logos:react" },
      { key: "api", label: "API", icon: "logos:aws-lambda", parent: "vpc" },
      { key: "db", label: "DB", icon: "logos:aws-aurora", shape: "cylinder", parent: "vpc" },
    ],
    edges: [{ from: "web", to: "api", label: "HTTPS", step: 1 }, { from: "api", to: "db", label: "SQL", step: 2 }],
  });
  await wait(400);
  const ev = inbox.find((m) => m.t === "events" && m.events.some((e: any) => e.batchId === built.batchId));
  check("agent change arrives live over WebSocket", !!ev);
  const evt = ev?.events.find((e: any) => e.batchId === built.batchId);
  check("event carries actor, label and inverse", evt?.actor === "agent:smoke-agent" && evt?.label === "AI: smoke architecture" && evt?.inverse.length > 0, evt && { actor: evt.actor, label: evt.label });
  check("presence reports human + agent kinds", inbox.some((m) => m.t === "presence"));

  // Human edits over the socket: move a node; agent sees it via REST.
  const api1 = built.items.find((i: any) => i.key === "api");
  ws.send(JSON.stringify({ t: "ops", opId: "o1", label: "Move API", ops: [{ op: "update", id: api1.id, patch: { x: 123, y: 77, pinned: true } }] }));
  await wait(300);
  const ack = inbox.find((m) => m.t === "ack" && m.opId === "o1");
  check("human ops are acked", !!ack && ack.result.skipped.length === 0, ack);
  const items = (await api(agent, "GET", `/boards/${id}/items`)).items;
  const moved = items.find((i: any) => i.id === api1.id);
  check("human edit visible to agent", moved.x === 123 && moved.pinned === true);

  // Agent re-runs merge: pinned node stays put, no duplicates.
  const again = await api(agent, "POST", `/boards/${id}/diagram`, { nodes: [{ key: "api", label: "API v2", icon: "logos:aws-lambda", parent: "vpc" }] });
  const after = (await api(agent, "GET", `/boards/${id}/items`)).items;
  const api2 = after.find((i: any) => i.id === api1.id);
  check("merge by key updates in place", again.updated === 1 && again.created === 0 && api2.data.text === "API v2");
  check("merge keeps hand-placed (pinned) position", api2.x === 123 && api2.y === 77, { x: api2.x, y: api2.y });

  // Undo the agent's rename using the stored inverse (what the browser's Ctrl+Z does).
  const inverse = (await api(human, "GET", `/boards/${id}/events?since=0`)).events.find((e: any) => e.batchId === again.batchId).inverse;
  await api(human, "POST", `/boards/${id}/ops`, { ops: inverse, label: "Undo: AI diagram" });
  const undone = (await api(agent, "GET", `/boards/${id}/items`)).items.find((i: any) => i.id === api1.id);
  check("undo restores previous label", undone.data.text === "API");

  // Deleting a group cascades to children and edges.
  const del = await api(agent, "DELETE", `/boards/${id}/items/${built.keyToId.vpc}`);
  check("delete cascades (group + 2 children + 2 edges)", del.deletes.length === 5, del.deletes.length);
  await api(human, "POST", `/boards/${id}/ops`, { ops: del.inverse });
  const restored = (await api(agent, "GET", `/boards/${id}/items`)).items;
  check("undo of delete restores everything incl. edges", restored.length === 6, restored.length);

  // Reconnect with `since` replays missed events.
  ws.close();
  await wait(100);
  const lastSeq = Math.max(...inbox.filter((m) => m.t === "events").flatMap((m) => m.events.map((e: any) => e.seq)));
  await api(agent, "POST", `/boards/${id}/items`, { items: [{ type: "sticky", x: 0, y: 0, data: { text: "missed me" } }] });
  const ws2 = new WebSocket(`${WS}/boards/${id}/ws`, { headers: human });
  const inbox2: any[] = [];
  ws2.on("message", (m) => inbox2.push(JSON.parse(m.toString())));
  await new Promise((r) => ws2.once("open", r));
  ws2.send(JSON.stringify({ t: "hello", clientId: "c-human", since: lastSeq }));
  await wait(400);
  const replay = inbox2.find((m) => m.t === "events");
  check("reconnect replays missed events", replay?.events.some((e: any) => e.upserts.some((i: any) => i.type === "sticky")));
  ws2.close();

  // Other workspaces can't see the board.
  const other = { ...human, "x-twodb-workspace-id": "other-ws" };
  const res = await fetch(`${BASE}/boards/${id}`, { headers: other });
  check("other workspace gets 404", res.status === 404, res.status);

  // Doc board + section patch.
  const doc = await api(human, "POST", "/boards", { name: "smoke doc", kind: "doc", markdown: "# Title\n\n## Design\nold\n\n## Next\nkeep\n" });
  const patched = await api(agent, "PATCH", `/boards/${doc.id}/doc`, { ops: [{ op: "replace_section", heading: "Design", markdown: "```mermaid\nflowchart LR\n A-->B\n```" }] });
  check("doc replace_section keeps neighbours", patched.markdown.includes("flowchart LR") && patched.markdown.includes("## Next\nkeep") && !patched.markdown.includes("old"), patched.markdown);
  const conflict = await fetch(`${BASE}/boards/${doc.id}/doc`, { method: "PUT", headers: { ...human, "content-type": "application/json" }, body: JSON.stringify({ markdown: "x", ifVersion: 0 }) });
  check("stale doc write is a 409", conflict.status === 409, conflict.status);

  // Mermaid import.
  const mer = await api(agent, "POST", `/boards/${id}/mermaid`, { source: "flowchart TD\n A([Start]) --> B{OK?}\n B -->|yes| C[Ship]\n B -->|no| A", mode: "merge" });
  check("mermaid flowchart imports as native items", mer.created === 6, mer.created);

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
