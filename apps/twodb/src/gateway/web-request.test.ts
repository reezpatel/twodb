import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { sendWebResponse } from "./web-request.js";

async function build() {
  const app = Fastify();
  await app.register(cors, { origin: (o, cb) => cb(null, !o || o === "https://artisan.twodb.io"), credentials: true });
  app.get("/web", async (_req, reply) => {
    const headers = new Headers({ "content-type": "application/json", vary: "Accept-Encoding" });
    headers.append("set-cookie", "a=1; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    await sendWebResponse(reply, new Response('{"ok":true}', { status: 200, headers }));
  });
  app.get("/empty", async (_req, reply) => sendWebResponse(reply, new Response(null, { status: 204 })));
  return app;
}

test("responses written through sendWebResponse keep the CORS headers", async () => {
  const app = await build();
  const r = await app.inject({ url: "/web", headers: { origin: "https://artisan.twodb.io" } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers["access-control-allow-origin"], "https://artisan.twodb.io");
  assert.equal(r.headers["access-control-allow-credentials"], "true");
  assert.match(String(r.headers.vary), /Origin/);
  assert.match(String(r.headers.vary), /Accept-Encoding/);
  assert.equal(r.json().ok, true);
  const e = await app.inject({ url: "/empty", headers: { origin: "https://artisan.twodb.io" } });
  assert.equal(e.statusCode, 204);
  assert.equal(e.headers["access-control-allow-origin"], "https://artisan.twodb.io");
  const other = await app.inject({ url: "/web", headers: { origin: "https://evil.example" } });
  assert.equal(other.headers["access-control-allow-origin"], undefined, "disallowed origins still get nothing");
  await app.close();
});

test("multiple Set-Cookie headers are all preserved", async () => {
  const app = await build();
  const r = await app.inject({ url: "/web" });
  assert.deepEqual([r.headers["set-cookie"]].flat(), ["a=1; Path=/", "b=2; Path=/"]);
  await app.close();
});
